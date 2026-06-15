import { motion } from 'framer-motion';
import { Users, Upload, AlertTriangle, Archive, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';

interface ControlModulesProps {
  onTabSelect: (tab: 'manage' | 'upload' | 'reports' | 'backlog') => void;
}

export default function ControlModules({ onTabSelect }: ControlModulesProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 pl-1">
        <TrendingUp className="w-5 h-5 text-purple-400" /> Control Modules
      </h2>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5, staggerChildren: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {/* Manage Counters Card */}
        <motion.div whileHover={{ scale: 1.04, y: -8 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={() => onTabSelect('manage')}>
          <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/40 hover:shadow-[0_15px_30px_rgba(139,92,246,0.1)] transition-all group h-full duration-300">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-[#222222] rounded-2xl group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                <Users className="w-8 h-8 text-white transition-colors group-hover:text-purple-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-white group-hover:text-purple-400 transition-colors">Counter Management</h3>
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">Manage counters, auditors, and team leads.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upload & Compare Card */}
        <motion.div whileHover={{ scale: 1.04, y: -8 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={() => onTabSelect('upload')}>
          <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/40 hover:shadow-[0_15px_30px_rgba(139,92,246,0.1)] transition-all group h-full duration-300">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-[#222222] rounded-2xl group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                <Upload className="w-8 h-8 text-white transition-colors group-hover:text-purple-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-white group-hover:text-purple-400 transition-colors">Upload & Compare</h3>
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">Upload Admin excels and trigger automated three-way comparisons.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Reports Slider Card */}
        <motion.div whileHover={{ scale: 1.04, y: -8 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={() => onTabSelect('reports')}>
          <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/40 hover:shadow-[0_15px_30px_rgba(139,92,246,0.1)] transition-all group h-full duration-300">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-[#222222] rounded-2xl group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                <AlertTriangle className="w-8 h-8 text-white transition-colors group-hover:text-purple-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-white group-hover:text-purple-400 transition-colors">Reports Slider</h3>
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">Examine and update transaction reports through interactive slides.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Backlog Card */}
        <motion.div whileHover={{ scale: 1.04, y: -8 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={() => onTabSelect('backlog')}>
          <Card className="bg-[#111111] border-[#222222] hover:border-purple-500/40 hover:shadow-[0_15px_30px_rgba(139,92,246,0.1)] transition-all group h-full duration-300">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-[#222222] rounded-2xl group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                <Archive className="w-8 h-8 text-white transition-colors group-hover:text-purple-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-white group-hover:text-purple-400 transition-colors">Backlog Reports</h3>
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">Search through previous day records and wipe historical entries safely.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
