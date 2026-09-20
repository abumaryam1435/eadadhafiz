
import React, { useContext } from 'react';
import { Evaluation, Student, UserRole } from '../types';
import { AppContext } from '../App';

interface DashboardStatsProps {
    evaluations: Evaluation[];
    students: Student[];
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4 rtl:space-x-reverse dark:bg-gray-800">
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        </div>
    </div>
);

const DashboardStats: React.FC<DashboardStatsProps> = ({ evaluations = [], students = [] }) => {
    const context = useContext(AppContext);
    
    // Fallback if context is missing
    const users = context && context.users ? context.users : [];

    const totalStudents = (students || []).length;
    const totalTeachers = users.filter(u => u.role === UserRole.TEACHER).length;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <StatCard 
                title="إجمالي الطلاب" 
                value={totalStudents} 
                color="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.084-1.282-.237-1.88M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.084-1.282.237-1.88M12 12a4 4 0 100-8 4 4 0 000 8z" /></svg>} 
            />
             <StatCard 
                title="إجمالي المعلمين" 
                value={totalTeachers} 
                color="bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} 
            />
        </div>
    );
};

export default DashboardStats;