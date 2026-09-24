import { useMemo } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Chart, Doughnut } from 'react-chartjs-2';
import { useTema } from '@/hooks/useTema';

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

/**
 * Paleta categórica **fixa**, nunca cíclica — do sétimo item em diante, "Outros".
 * Duas fatias da mesma cor num gráfico de composição fazem ler duas categorias como uma.
 */
export const PALETA = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] as const;

function useCores() {
  const { tema } = useTema();

  return useMemo(
    () =>
      tema === 'escuro'
        ? { texto: '#8891b0', grade: 'rgba(255,255,255,0.06)', fundoDica: '#141a2e', bordaDica: '#2c3659', tinta: '#eef1fb' }
        : { texto: '#6b7390', grade: 'rgba(15,22,41,0.06)', fundoDica: '#0f1629', bordaDica: '#0f1629', tinta: '#ffffff' },
    [tema],
  );
}

interface PropsDaSerie {
  readonly rotulos: readonly string[];
  readonly enviados: readonly number[];
  readonly concluidos: readonly number[];
  /** Nome acessível: o canvas é opaco para leitor de tela. */
  readonly descricao: string;
}

/** Barras de enviados + linha de concluídos, por mês. */
export function GraficoMensal({ rotulos, enviados, concluidos, descricao }: PropsDaSerie) {
  const cores = useCores();

  const dados: ChartData<'bar' | 'line'> = {
    labels: [...rotulos],
    datasets: [
      {
        type: 'bar',
        label: 'Enviados',
        data: [...enviados],
        backgroundColor: 'rgba(79,70,229,0.18)',
        hoverBackgroundColor: 'rgba(79,70,229,0.32)',
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 34,
        order: 2,
      },
      {
        type: 'line',
        label: 'Concluídos',
        data: [...concluidos],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6,182,212,0.12)',
        pointBackgroundColor: '#06b6d4',
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        order: 1,
      },
    ],
  };

  const opcoes: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { color: cores.texto, usePointStyle: true, boxWidth: 8, padding: 18, font: { family: 'Inter', size: 12 } } },
      tooltip: {
        backgroundColor: cores.fundoDica,
        borderColor: cores.bordaDica,
        borderWidth: 1,
        titleColor: cores.tinta,
        bodyColor: cores.tinta,
        padding: 12,
        cornerRadius: 10,
        titleFont: { family: 'Inter', weight: 600 },
        bodyFont: { family: 'Inter' },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: cores.texto, font: { family: 'Inter', size: 11 } } },
      y: { beginAtZero: true, grid: { color: cores.grade }, border: { display: false }, ticks: { color: cores.texto, precision: 0, font: { family: 'Inter', size: 11 } } },
    },
  };

  return (
    <div className="h-72">
      <Chart type="bar" data={dados} options={opcoes} role="img" aria-label={descricao} />
    </div>
  );
}

interface Fatia {
  readonly rotulo: string;
  readonly valor: number;
  readonly cor: string;
}

export function GraficoDeRosca({ fatias, descricao, centro }: { readonly fatias: readonly Fatia[]; readonly descricao: string; readonly centro: { valor: string; rotulo: string } }) {
  const cores = useCores();
  const visiveis = fatias.filter((f) => f.valor > 0);

  return (
    <div className="relative mx-auto h-52 w-52">
      <Doughnut
        role="img"
        aria-label={descricao}
        data={{
          labels: visiveis.map((f) => f.rotulo),
          datasets: [{ data: visiveis.map((f) => f.valor), backgroundColor: visiveis.map((f) => f.cor), borderWidth: 0, hoverOffset: 6, spacing: 2 }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '74%',
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: cores.fundoDica, titleColor: cores.tinta, bodyColor: cores.tinta, padding: 10, cornerRadius: 10 },
          },
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-tinta text-3xl font-extrabold numeros">{centro.valor}</span>
        <span className="text-tinta-3 text-xs">{centro.rotulo}</span>
      </div>
    </div>
  );
}
