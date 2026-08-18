import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { api } from '@/lib/api';
import type { SalesSummary, MonthlyChartData } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
}

function fmtFull(v: number) {
  return `$${Math.round(v).toLocaleString('es-AR')}`;
}

function pct(a: number, b: number): number | null {
  if (b === 0) return a > 0 ? 100 : null;
  return Math.round(((a - b) / b) * 100);
}

// ─── Bar chart (SVG) ─────────────────────────────────────────────────────────

const CHART_H    = 180;
const CHART_W    = 340;
const BAR_GAP    = 4;
const GROUP_GAP  = 6;
const LABEL_H    = 18;
const TOP_PAD    = 12;
const CHART_AREA = CHART_H - LABEL_H - TOP_PAD;

function BarChart({ data }: { data: MonthlyChartData[] }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  const numGroups   = data.length;          // 12
  const barW        = 8;
  const groupW      = barW * 2 + BAR_GAP;
  const totalGroupsW = groupW * numGroups + GROUP_GAP * (numGroups - 1);
  const leftPad     = 2;

  const barX = (i: number, barIdx: number) =>
    leftPad + i * (groupW + GROUP_GAP) + barIdx * (barW + BAR_GAP);

  const barH = (v: number) => (v / maxVal) * CHART_AREA;
  const barY = (v: number) => TOP_PAD + CHART_AREA - barH(v);

  const svgW = Math.max(totalGroupsW + leftPad * 2, CHART_W);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={svgW} height={CHART_H}>
        {/* Guideline */}
        <Line
          x1={0} y1={TOP_PAD + CHART_AREA}
          x2={svgW} y2={TOP_PAD + CHART_AREA}
          stroke="#E5E7EB" strokeWidth={1}
        />
        <Line
          x1={0} y1={TOP_PAD + CHART_AREA / 2}
          x2={svgW} y2={TOP_PAD + CHART_AREA / 2}
          stroke="#F3F4F6" strokeWidth={1} strokeDasharray="4,3"
        />

        {data.map((d, i) => {
          const th = barH(d.total);
          const ph = barH(d.profit);
          const tx = barX(i, 0);
          const px = barX(i, 1);
          const ty = barY(d.total);
          const py = barY(d.profit);
          const labelX = tx + barW / 2;

          return (
            <Svg key={d.month}>
              {/* Total bar (blue) */}
              <Rect
                x={tx} y={ty}
                width={barW} height={Math.max(th, 2)}
                rx={2} fill="#3B82F6" opacity={0.85}
              />
              {/* Profit bar (green) */}
              <Rect
                x={px} y={py}
                width={barW} height={Math.max(ph, 2)}
                rx={2} fill="#10B981" opacity={0.85}
              />
              {/* Month label */}
              <SvgText
                x={labelX} y={CHART_H - 2}
                fontSize={8} textAnchor="middle"
                fill="#9CA3AF"
              >
                {MONTH_SHORT[d.month - 1]}
              </SvgText>
            </Svg>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

// ─── Month picker modal ───────────────────────────────────────────────────────

type MonthYear = { month: number; year: number };

function MonthPicker({
  value,
  onChange,
  label,
}: {
  value: MonthYear;
  onChange: (v: MonthYear) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(value.year);

  const currentYear = new Date().getFullYear();

  return (
    <>
      <TouchableOpacity
        onPress={() => { setPickerYear(value.year); setOpen(true); }}
        className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-3 items-center"
        activeOpacity={0.7}
      >
        <Text className="text-xs text-gray-400 mb-0.5">{label}</Text>
        <Text className="text-sm font-bold text-gray-900">
          {MONTH_NAMES[value.month - 1]}
        </Text>
        <Text className="text-xs text-gray-500">{value.year}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-black/40"
          activeOpacity={1}
          onPress={() => setOpen(false)}
        />
        <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl pb-8">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
            <Text className="text-base font-semibold text-gray-900">Seleccionar mes</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Year nav */}
          <View className="flex-row items-center justify-center gap-6 py-4">
            <TouchableOpacity
              onPress={() => setPickerYear((y) => y - 1)}
              disabled={pickerYear <= currentYear - 5}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={22} color={pickerYear <= currentYear - 5 ? '#D1D5DB' : '#374151'} />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900 w-16 text-center">{pickerYear}</Text>
            <TouchableOpacity
              onPress={() => setPickerYear((y) => y + 1)}
              disabled={pickerYear >= currentYear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronRight size={22} color={pickerYear >= currentYear ? '#D1D5DB' : '#374151'} />
            </TouchableOpacity>
          </View>

          {/* Month grid */}
          <View className="flex-row flex-wrap px-4 gap-2">
            {MONTH_NAMES.map((name, idx) => {
              const m = idx + 1;
              const isSelected = value.month === m && value.year === pickerYear;
              const isFuture = pickerYear === currentYear && m > new Date().getMonth() + 1;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => {
                    onChange({ month: m, year: pickerYear });
                    setOpen(false);
                  }}
                  disabled={isFuture}
                  className={`rounded-xl py-2.5 items-center ${isFuture ? 'opacity-30' : ''}`}
                  style={{ width: '30%' }}
                  activeOpacity={0.7}
                >
                  <View
                    className={`w-full items-center py-2 rounded-xl ${isSelected ? 'bg-blue-500' : 'bg-gray-100'}`}
                  >
                    <Text
                      className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}
                    >
                      {name}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Comparison row ───────────────────────────────────────────────────────────

function CompareRow({
  label,
  a,
  b,
}: {
  label: string;
  a: number;
  b: number;
}) {
  const diff = pct(a, b);
  const up = diff !== null && diff > 0;
  const down = diff !== null && diff < 0;

  return (
    <View className="flex-row items-center py-3 border-b border-gray-100">
      <Text className="text-sm text-gray-500 flex-1">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900 w-28 text-right">{fmtFull(a)}</Text>
      <Text className="text-sm font-semibold text-gray-900 w-28 text-right">{fmtFull(b)}</Text>
      <View className="w-16 items-end">
        {diff === null ? (
          <Minus size={14} color="#9CA3AF" />
        ) : (
          <View
            className="flex-row items-center gap-0.5 px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: up ? '#F0FDF4' : down ? '#FFF1F2' : '#F9FAFB' }}
          >
            {up   ? <TrendingUp   size={11} color="#16A34A" /> : null}
            {down ? <TrendingDown size={11} color="#DC2626" /> : null}
            <Text
              className="text-xs font-bold"
              style={{ color: up ? '#16A34A' : down ? '#DC2626' : '#6B7280' }}
            >
              {diff === 0 ? '0%' : `${diff > 0 ? '+' : ''}${diff}%`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SalesStatsScreen() {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [chartYear, setChartYear] = useState(currentYear);
  const [monthA, setMonthA] = useState<MonthYear>({
    month: currentMonth === 1 ? 12 : currentMonth - 1,
    year:  currentMonth === 1 ? currentYear - 1 : currentYear,
  });
  const [monthB, setMonthB] = useState<MonthYear>({ month: currentMonth, year: currentYear });

  // Chart query
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['sales-monthly-chart', chartYear],
    queryFn: () => api.get<MonthlyChartData[]>(`/sales/monthly-chart?year=${chartYear}`),
  });

  // Comparison queries
  const { data: summaryA, isLoading: loadingA } = useQuery({
    queryKey: ['sales-monthly-summary', monthA.year, monthA.month],
    queryFn: () =>
      api.get<SalesSummary>(`/sales/monthly-summary?year=${monthA.year}&month=${monthA.month}`),
  });

  const { data: summaryB, isLoading: loadingB } = useQuery({
    queryKey: ['sales-monthly-summary', monthB.year, monthB.month],
    queryFn: () =>
      api.get<SalesSummary>(`/sales/monthly-summary?year=${monthB.year}&month=${monthB.month}`),
  });

  const compareLoading = loadingA || loadingB;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-4 border-b border-gray-100 bg-white flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Estadísticas</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Evolución anual ──────────────────────────────────── */}
        <View className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-4">
          {/* Year nav */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-sm font-semibold text-gray-900">Evolución anual</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => setChartYear((y) => y - 1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronLeft size={18} color="#374151" />
              </TouchableOpacity>
              <Text className="text-sm font-bold text-gray-800 w-12 text-center">{chartYear}</Text>
              <TouchableOpacity
                onPress={() => setChartYear((y) => y + 1)}
                disabled={chartYear >= currentYear}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronRight size={18} color={chartYear >= currentYear ? '#D1D5DB' : '#374151'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Legend */}
          <View className="flex-row gap-4 mb-3">
            <View className="flex-row items-center gap-1.5">
              <View className="w-3 h-3 rounded-sm bg-blue-500 opacity-85" />
              <Text className="text-xs text-gray-500">Facturado</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-3 h-3 rounded-sm bg-emerald-500 opacity-85" />
              <Text className="text-xs text-gray-500">Ganancia</Text>
            </View>
          </View>

          {chartLoading ? (
            <View className="h-44 items-center justify-center">
              <ActivityIndicator color="#3B82F6" />
            </View>
          ) : chartData ? (
            <>
              <BarChart data={chartData} />
              {/* Summary row */}
              <View className="flex-row gap-3 mt-4 pt-3 border-t border-gray-100">
                <View className="flex-1 items-center">
                  <Text className="text-xs text-gray-400 mb-0.5">Total anual</Text>
                  <Text className="text-base font-bold text-gray-900">
                    {fmt(chartData.reduce((s, d) => s + d.total, 0))}
                  </Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-xs text-gray-400 mb-0.5">Ganancia anual</Text>
                  <Text className="text-base font-bold text-emerald-600">
                    {fmt(chartData.reduce((s, d) => s + d.profit, 0))}
                  </Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-xs text-gray-400 mb-0.5">Ventas totales</Text>
                  <Text className="text-base font-bold text-gray-900">
                    {chartData.reduce((s, d) => s + d.count, 0)}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* ── Comparativa de meses ─────────────────────────────── */}
        <View className="mx-4 mt-4 mb-6 bg-white rounded-2xl border border-gray-100 p-4">
          <Text className="text-sm font-semibold text-gray-900 mb-3">Comparar meses</Text>

          {/* Month pickers */}
          <View className="flex-row gap-3 mb-4">
            <MonthPicker value={monthA} onChange={setMonthA} label="Período A" />
            <View className="items-center justify-center">
              <Text className="text-gray-300 font-light text-xl">vs</Text>
            </View>
            <MonthPicker value={monthB} onChange={setMonthB} label="Período B" />
          </View>

          {compareLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#3B82F6" />
            </View>
          ) : summaryA && summaryB ? (
            <>
              {/* Column headers */}
              <View className="flex-row pb-2 border-b border-gray-200">
                <Text className="flex-1 text-xs text-gray-400">Métrica</Text>
                <Text className="text-xs text-gray-500 font-medium w-28 text-right">
                  {MONTH_SHORT[monthA.month - 1]} {monthA.year}
                </Text>
                <Text className="text-xs text-gray-500 font-medium w-28 text-right">
                  {MONTH_SHORT[monthB.month - 1]} {monthB.year}
                </Text>
                <Text className="text-xs text-gray-400 w-16 text-right">Var.</Text>
              </View>

              <CompareRow label="Facturado"    a={summaryA.total}     b={summaryB.total} />
              <CompareRow label="Ganancia"     a={summaryA.profit}    b={summaryB.profit} />
              <CompareRow label="Ventas"       a={summaryA.count}     b={summaryB.count} />
              <CompareRow label="Ticket prom." a={summaryA.avgTicket} b={summaryB.avgTicket} />

              {/* Payment method breakdown */}
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">
                Por método de pago
              </Text>
              <CompareRow label="Efectivo"      a={summaryA.byPaymentMethod.cash}     b={summaryB.byPaymentMethod.cash} />
              <CompareRow label="Tarjeta"       a={summaryA.byPaymentMethod.card}     b={summaryB.byPaymentMethod.card} />
              <CompareRow label="Transferencia" a={summaryA.byPaymentMethod.transfer} b={summaryB.byPaymentMethod.transfer} />

              {/* Net diff summary */}
              {(() => {
                const diffPct = pct(summaryA.total, summaryB.total);
                if (diffPct === null) return null;
                const up = diffPct > 0;
                const down = diffPct < 0;
                return (
                  <View
                    className="mt-4 rounded-xl p-3 flex-row items-center gap-2"
                    style={{ backgroundColor: up ? '#F0FDF4' : down ? '#FFF1F2' : '#F9FAFB' }}
                  >
                    {up   ? <TrendingUp   size={18} color="#16A34A" /> : null}
                    {down ? <TrendingDown size={18} color="#DC2626" /> : null}
                    {!up && !down ? <Minus size={18} color="#9CA3AF" /> : null}
                    <Text
                      className="text-sm font-semibold flex-1"
                      style={{ color: up ? '#16A34A' : down ? '#DC2626' : '#6B7280' }}
                    >
                      {diffPct === 0
                        ? 'Sin variación en facturado'
                        : `${MONTH_SHORT[monthA.month - 1]} ${monthA.year} facturó ${Math.abs(diffPct)}% ${up ? 'más' : 'menos'} que ${MONTH_SHORT[monthB.month - 1]} ${monthB.year}`}
                    </Text>
                  </View>
                );
              })()}
            </>
          ) : null}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
