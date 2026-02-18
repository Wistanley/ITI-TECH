import React from 'react';
import { WeeklyHistory, Task, BoardTask } from '../types';
import { Calendar, Clock, CheckCircle, Download, ChevronRight, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface HistoryViewProps {
    history: WeeklyHistory[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history }) => {

    const handleExport = (week: WeeklyHistory) => {
        // 1. Prepare Data for Tasks Sheet
        const tasksData = week.tasks.map(t => ({
            Projeto: t.projectId, // Idealmente buscar nome, mas snapshot guarda estrutura bruta
            Setor: t.sector,
            Colaborador: t.collaboratorId, // Mesmo aqui
            'Atividade Planejada': t.plannedActivity,
            'Atividade Entregue': t.deliveredActivity,
            Status: t.status,
            Prioridade: t.priority,
            'Data Entrega': t.dueDate,
            'Horas Dedicadas': t.hoursDedicated,
            'Observações': t.notes
        }));

        // 2. Prepare Data for Board Sheet
        const boardData = week.boardTasks.map(b => ({
            Titulo: b.title,
            Status: b.status,
            'Data Inicio': b.startDate,
            'Data Fim': b.endDate,
            'Descrição': b.description
        }));

        // 3. Create Workbook
        const wb = XLSX.utils.book_new();
        const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
        const boardSheet = XLSX.utils.json_to_sheet(boardData);

        XLSX.utils.book_append_sheet(wb, tasksSheet, "Atividades");
        XLSX.utils.book_append_sheet(wb, boardSheet, "Quadro");

        // 4. Download
        const fileName = `Relatorio_Semana_${new Date(week.createdAt).toLocaleDateString().replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Calendar size={48} className="mb-4 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Nenhum histórico encontrado</h2>
                <p>Feche uma semana nas configurações para gerar um histórico.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Histórico Semanal</h2>
                    <p className="text-slate-400">Visualize e exporte os dados de semanas anteriores.</p>
                </div>
            </div>

            <div className="grid gap-4">
                {history.map((week) => (
                    <div key={week.id} className="bg-navy-800/50 border border-slate-700/50 rounded-xl p-6 hover:bg-navy-800 transition-all group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:text-blue-300 transition-colors">
                                    <Calendar size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">
                                        Semana de {new Date(week.createdAt).toLocaleDateString('pt-BR')}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Clock size={14} />
                                            {week.totalHours} horas
                                        </span>
                                        <span className="flex items-center gap-1 text-emerald-400">
                                            <CheckCircle size={14} />
                                            {week.tasksCompleted} comcluídas
                                        </span>
                                        <span className="flex items-center gap-1 text-amber-400">
                                            <XCircle size={14} />
                                            {week.tasksPending} pendentes
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pl-16 md:pl-0">
                                <div className="text-right hidden md:block">
                                    <div className="text-sm font-medium text-slate-300">
                                        {week.tasks.length} Atividades
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {week.boardTasks.length} Cards no Quadro
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleExport(week)}
                                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                                >
                                    <Download size={16} />
                                    Baixar Excel
                                </button>
                            </div>

                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
