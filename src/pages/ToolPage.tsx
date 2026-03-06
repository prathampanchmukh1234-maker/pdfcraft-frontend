import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TOOLS } from '@/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileText, Download, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { Session } from '@supabase/supabase-js';
import SignToolInterface, { PlacedField } from '@/components/SignToolInterface';
import { cn } from '@/lib/utils';

export default function ToolPage({ session }: { session: Session | null }) {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const tool = TOOLS.find((t) => t.id === toolId);
  
  const [files, setFiles] = useState<File[]>([]);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<any>({
    pages: '1-1',
    angle: '90',
    x: '50',
    y: '50',
    scale: '0.5',
    pageNum: '1'
  });

  if (!tool) return <div>Tool not found</div>;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setResultUrl(null);
      setError(null);
    }
  };

  const onSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSignatureFile(e.target.files[0]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (placedFields?: PlacedField[], customSignatureFile?: File | null) => {
    if (!session) {
      navigate('/login');
      return;
    }

    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    
    // Handle files based on tool type
    if (toolId === 'merge' || toolId === 'image-to-pdf' || toolId === 'jpg-to-pdf') {
      files.forEach((file) => formData.append('files', file));
    } else if (toolId === 'sign' || toolId === 'edit') {
      formData.append('file', files[0]);
      const sigToUse = customSignatureFile || signatureFile;
      if (sigToUse) {
        formData.append('signature', sigToUse);
      }
    } else {
      formData.append('file', files[0]);
    }
    
    if (placedFields) {
      formData.append('placedFields', JSON.stringify(placedFields));
    }

    formData.append('userId', session.user.id);
    
    Object.keys(options).forEach(key => {
      formData.append(key, options[key]);
    });

    try {
      const endpoint = `/api/${toolId}`;
      console.log(`Sending request to ${endpoint}...`);
      const response = await axios.post(endpoint, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${session.access_token}`
        },
      });
      setResultUrl(response.data.url);
    } catch (err: any) {
      console.error('Processing error:', err);
      const message = err.response?.data?.error || err.message || 'An error occurred during processing';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const getOutputExtension = () => {
    switch (toolId) {
      case 'pdf-to-word': return '.docx';
      case 'pdf-to-excel': return '.xlsx';
      case 'pdf-to-powerpoint': return '.pptx';
      case 'pdf-to-jpg': return '.zip';
      case 'merge': return '.pdf';
      case 'split': return '.pdf'; // Or .zip if we change backend
      case 'compress': return '.pdf';
      case 'word-to-pdf': return '.pdf';
      case 'excel-to-pdf': return '.pdf';
      case 'powerpoint-to-pdf': return '.pdf';
      case 'image-to-pdf':
      case 'jpg-to-pdf': return '.pdf';
      case 'protect':
      case 'unlock':
      case 'watermark':
      case 'rotate': return '.pdf';
      default: return '.pdf';
    }
  };

  const handleDownload = async () => {
    if (!resultUrl) return;
    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = localUrl;
      
      // Try to get extension from the result URL first
      const urlPath = new URL(resultUrl).pathname;
      const urlExtension = urlPath.split('.').pop();
      const extension = urlExtension && urlExtension.length < 5 ? `.${urlExtension}` : getOutputExtension();
      
      const originalName = files[0]?.name || 'document';
      const baseName = originalName.split('.').slice(0, -1).join('.') || originalName;
      link.download = `processed_${baseName}${extension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(localUrl), 100);
    } catch (error) {
      console.error('Download error:', error);
      window.open(resultUrl, '_blank');
    }
  };

  // Special interface for Sign PDF or Edit PDF
  if ((tool.id === 'sign' || tool.id === 'edit') && files.length > 0) {
    return (
      <SignToolInterface 
        file={files[0]}
        session={session!}
        onSign={() => {}} // Client-side signing is handled within the component
        onChangeFile={() => setFiles([])}
        loading={loading}
        resultUrl={resultUrl}
        toolId={tool.id}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className={cn(
          tool.color === 'bg-red-500' ? 'bg-[#e5322d]' : tool.color,
          "w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-current/20 mb-4"
        )}>
          <tool.icon className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">{tool.name}</h1>
        <p className="text-slate-500">{tool.description}</p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-8">
        {!resultUrl ? (
          <>
            <div className="relative group">
              <input
                type="file"
                multiple={tool.id === 'merge' || tool.id === 'image-to-pdf' || tool.id === 'jpg-to-pdf'}
                accept={
                  tool.id === 'image-to-pdf' || tool.id === 'jpg-to-pdf' ? 'image/*' : 
                  tool.id === 'word-to-pdf' ? '.doc,.docx' :
                  tool.id === 'excel-to-pdf' ? '.xls,.xlsx' :
                  tool.id === 'powerpoint-to-pdf' ? '.ppt,.pptx' :
                  'application/pdf'
                }
                onChange={onFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border-2 border-dashed border-slate-200 group-hover:border-[#e5322d] rounded-2xl p-12 text-center transition-colors bg-slate-50 group-hover:bg-red-50/30">
                <Upload className="w-12 h-12 text-slate-300 group-hover:text-[#e5322d] mx-auto mb-4 transition-colors" />
                <p className="text-lg font-medium text-slate-700">
                  {files.length > 0 ? `${files.length} files selected` : 'Select PDF files'}
                </p>
                <p className="text-sm text-slate-400 mt-1">or drag and drop them here</p>
              </div>
            </div>

            <AnimatePresence>
              {files.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {tool.id === 'split' && (
                    <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                      <label className="text-sm font-medium text-slate-700">Page Range (e.g., 1-5)</label>
                      <input
                        type="text"
                        value={options.pages || '1-1'}
                        onChange={(e) => setOptions({ ...options, pages: e.target.value })}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                  )}

                  {tool.id === 'compress' && (
                    <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                      <label className="text-sm font-medium text-slate-700">Compression Level</label>
                      <select
                        value={options.level || 'medium'}
                        onChange={(e) => setOptions({ ...options, level: e.target.value })}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      >
                        <option value="low">Low (High Quality)</option>
                        <option value="medium">Medium</option>
                        <option value="high">High (Smallest Size)</option>
                      </select>
                    </div>
                  )}
                  {tool.id === 'rotate' && (
                    <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Rotation Angle</label>
                        <select
                          value={options.angle}
                          onChange={(e) => setOptions({ ...options, angle: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                        >
                          <option value="90">90° Clockwise</option>
                          <option value="180">180°</option>
                          <option value="270">270° Clockwise</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Page Number (optional, leave empty for all pages)</label>
                        <input
                          type="number"
                          value={options.pageIndex === undefined ? '' : (parseInt(options.pageIndex) + 1)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOptions({ ...options, pageIndex: val === '' ? undefined : (parseInt(val) - 1).toString() });
                          }}
                          placeholder="e.g. 1"
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {(tool.id === 'protect' || tool.id === 'unlock') && (
                    <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                      <label className="text-sm font-medium text-slate-700">Password</label>
                      <input
                        type="password"
                        value={options.password || ''}
                        onChange={(e) => setOptions({ ...options, password: e.target.value })}
                        placeholder="Enter password"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                  )}
                  {tool.id === 'watermark' && (
                    <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                      <label className="text-sm font-medium text-slate-700">Watermark Text</label>
                      <input
                        type="text"
                        value={options.text || ''}
                        onChange={(e) => setOptions({ ...options, text: e.target.value })}
                        placeholder="e.g. CONFIDENTIAL"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 text-sm">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={() => handleSubmit()}
                    disabled={loading}
                    className="w-full py-4 bg-[#e5322d] hover:bg-[#d42d28] text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      tool.name
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 py-8"
          >
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-green-600 mb-4">
              <Download className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">File is ready!</h2>
              <p className="text-slate-500">Your file has been processed successfully.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleDownload}
                className="px-8 py-4 bg-[#e5322d] hover:bg-[#d42d28] text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Result
              </button>
              <button
                onClick={() => {
                  setResultUrl(null);
                  setFiles([]);
                }}
                className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
              >
                Process another
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
