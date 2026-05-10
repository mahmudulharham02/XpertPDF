import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileUp, Lock, Unlock, CheckCircle2, AlertCircle } from 'lucide-react';
import { downloadBlob, sanitizePdfBytes } from '../../lib/utils';
// @ts-ignore
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
// @ts-ignore
import { decryptPDF, isEncrypted } from '@pdfsmaller/pdf-decrypt';

export function EncryptTool() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'protect' | 'unlock'>('protect');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [fileValidationErr, setFileValidationErr] = useState("");
  const [encryptionStatus, setEncryptionStatus] = useState<string | null>(null);

  const checkEncryption = async (f: File) => {
    try {
      const bytes = sanitizePdfBytes(new Uint8Array(await f.arrayBuffer()));
      const info = await isEncrypted(bytes);
      if (info?.encrypted) {
         setEncryptionStatus(`Encrypted (${info.algorithm})`);
         if (mode === 'protect') setMode('unlock');
      } else {
         setEncryptionStatus('Not encrypted');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFileValidationErr('');
      setSuccessMsg('');
      setErrorMsg('');
      setEncryptionStatus(null);
      
      if (f.size > 100 * 1024 * 1024) {
         setFileValidationErr("File exceeds 100MB limit.");
         return;
      }
      setFile(f);
      setPassword('');
      await checkEncryption(f);
    }
  }, [mode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  } as any);

  const getValidationError = () => {
     if (mode === 'protect') {
        if (!password) return 'Password is required.';
        if (!/^\d+$/.test(password)) return 'Password must contain only numbers (0-9).';
        if (password.length < 4 || password.length > 12) return 'Password must be 4 to 12 digits.';
     } else {
        if (!password) return 'Password is required.';
     }
     return null;
  };

  const handleProcess = async () => {
     if (!file) return;
     const err = getValidationError();
     if (err) {
        setErrorMsg(err);
        return;
     }

     setLoading(true);
     setErrorMsg('');
     setSuccessMsg('');

     try {
       const bytes = sanitizePdfBytes(new Uint8Array(await file.arrayBuffer()));
       let processedBytes;
       let outName = file.name;

       if (mode === 'protect') {
          processedBytes = await encryptPDF(bytes, password);
          outName = file.name.replace('.pdf', '_protected.pdf');
       } else {
          processedBytes = await decryptPDF(bytes, password);
          outName = file.name.replace('.pdf', '_unlocked.pdf');
       }

       const blob = new Blob([processedBytes], { type: 'application/pdf' });
       downloadBlob(blob, outName);
       setSuccessMsg(mode === 'protect' ? 'PDF protected successfully!' : 'PDF unlocked successfully!');
       setPassword('');
     } catch (e: any) {
       console.error(e);
       setErrorMsg(e.message || 'Error processing PDF. Please check your password or file.');
     } finally {
       setLoading(false);
     }
  };

  return (
    <div className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 h-full w-full max-w-full">
      <div className="liquid-panel rounded-[24px] overflow-y-auto overflow-x-hidden flex flex-col flex-1 shadow-lg shadow-black/5 w-full">
        
        {/* Top: Upload Area */}
        <div className="p-6 sm:p-10 border-b border-black/5 dark:border-white/10 bg-white/20 dark:bg-black/20">
          <div className="mb-6 text-center">
             <div className="w-16 h-16 liquid-panel rounded-[24px] text-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/10 dark:text-teal-400">
               {mode === 'protect' ? <Lock className="w-8 h-8" /> : <Unlock className="w-8 h-8" />}
             </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Encrypt & Decrypt</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Add or remove numeric password protection</p>
          </div>
          
          {fileValidationErr && (
              <div className="max-w-2xl mx-auto mb-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-sm font-bold border border-rose-100 dark:border-rose-900/50 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {fileValidationErr}
              </div>
          )}

          {!file ? (
            <div 
              {...getRootProps()} 
              className={`max-w-2xl w-full mx-auto liquid-panel rounded-[24px] p-6 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 pointer-events-auto ${
                isDragActive ? 'scale-[1.02] bg-teal-50/50 dark:bg-teal-900/20 border-teal-400' : 'hover:bg-white/40 dark:hover:bg-white/5 border-dashed border-2 border-teal-200 dark:border-teal-800/50'
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-teal-500' : 'text-slate-400 dark:text-slate-500'}`} />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Drag & drop a PDF here</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">or click to choose file</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between liquid-panel p-4 rounded-xl px-6 gap-4">
               <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                     <FileUp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm border-none font-bold text-slate-700 dark:text-white line-clamp-1 truncate">{file.name}</h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                       {(file.size / 1024 / 1024).toFixed(2)} MB 
                       {encryptionStatus && ` • Status: ${encryptionStatus}`}
                    </p>
                  </div>
               </div>
               <button 
                  onClick={() => { setFile(null); setSuccessMsg(''); setErrorMsg(''); setPassword(''); }}
                  className="px-4 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors w-full sm:w-auto shrink-0"
               >
                  Change File
               </button>
            </div>
          )}
        </div>

        {/* Bottom: Options & Action */}
        <div className="flex-1 p-3 sm:p-8 flex flex-col items-center bg-transparent relative w-full">
          
          {file && (
             <div className="w-full max-w-2xl space-y-6">
                
                {errorMsg && (
                  <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 flex gap-2 items-center rounded-xl text-sm font-bold border border-rose-100 dark:border-rose-900/50">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <button onClick={() => setMode('protect')} disabled={encryptionStatus?.includes('Encrypted')} className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${mode === 'protect' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/10' : 'border-transparent bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                    <Lock className={`w-5 h-5 mb-2 ${mode === 'protect' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Protect PDF</span>
                    <span className="text-xs font-medium text-slate-500 mt-1 line-clamp-2 text-left">Add numeric password encryption</span>
                  </button>

                  <button onClick={() => setMode('unlock')} className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${mode === 'unlock' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/10' : 'border-transparent bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10'}`}>
                    <Unlock className={`w-5 h-5 mb-2 ${mode === 'unlock' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Unlock PDF</span>
                    <span className="text-xs font-medium text-slate-500 mt-1 line-clamp-2 text-left">Remove existing password</span>
                  </button>
                </div>

                <div className="liquid-panel rounded-xl p-5 border border-black/5 dark:border-white/10">
                   <div>
                     <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                         {mode === 'protect' ? 'Set Numeric Password' : 'Enter Existing Password'}
                     </label>
                     <div className="w-full overflow-hidden">
                       <input 
                         type="password" 
                         inputMode={mode === 'protect' ? "numeric" : "text"}
                         autoComplete="off"
                         value={password}
                         onChange={e => setPassword(e.target.value)}
                         placeholder={mode === 'protect' ? "e.g. 123456" : "Enter password to unlock"} 
                         className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-800 dark:text-white"
                       />
                     </div>
                     {mode === 'protect' && (
                        <p className="text-xs text-slate-500 mt-2 font-medium">Must be a numeric pin between 4 and 12 digits.</p>
                     )}
                   </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4 w-full">
                  {successMsg ? (
                    <div className="flex-1 flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-lg w-full sm:w-auto overflow-hidden">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span className="truncate">{successMsg}</span>
                    </div>
                  ) : <div className="hidden sm:block"></div>}
                  
                  <button 
                    onClick={handleProcess}
                    disabled={loading || !password}
                    className="flex justify-center items-center gap-2 px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 w-full sm:w-auto shrink-0 min-h-[44px]"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {mode === 'protect' ? <Lock className="w-5 h-5 shrink-0" /> : <Unlock className="w-5 h-5 shrink-0" />}
                        {mode === 'protect' ? 'Protect PDF' : 'Unlock PDF'}
                      </>
                    )}
                  </button>
                </div>

             </div>
          )}
        </div>
      </div>
    </div>
  );
}
