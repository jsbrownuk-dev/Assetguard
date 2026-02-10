import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Asset, AssetStatus, User, UserRole } from '../types';
import { storageService } from '../services/storage';
import { analyzeAssetImage } from '../services/gemini';
import { CameraCapture } from './CameraCapture';
import { Plus, Search, Trash2, AlertCircle, Calendar, PoundSterling, MapPin, Hash, Download, Camera, Loader2, Sparkles, Upload, FileSpreadsheet, X, CheckCircle } from 'lucide-react';

interface AssetListProps {
  currentUser: User;
}

export const AssetList: React.FC<AssetListProps> = ({ currentUser }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'disposed'>('active');
  const [search, setSearch] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDisposeModal, setShowDisposeModal] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Processing state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{success: number; errors: string[]} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [newAsset, setNewAsset] = useState({
    title: '',
    make: '',
    serialNumber: '',
    assetId: '',
    location: '',
    value: '',
  });

  const [disposalReason, setDisposalReason] = useState('');

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const data = await storageService.getAssets();
      setAssets(data);
    } catch (error) {
      console.error("Failed to load assets from API", error);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Title', 
      'Make', 
      'Serial Number', 
      'Asset ID', 
      'Location', 
      'Value', 
      'Status', 
      'Created By', 
      'Created At', 
      'Disposal Reason', 
      'Disposed By', 
      'Disposed At'
    ];
    
    const csvContent = [
      headers.join(','),
      ...assets.map(asset => [
        `"${asset.title.replace(/"/g, '""')}"`,
        `"${asset.make.replace(/"/g, '""')}"`,
        `"${asset.serialNumber.replace(/"/g, '""')}"`,
        `"${asset.assetId.replace(/"/g, '""')}"`,
        `"${asset.location.replace(/"/g, '""')}"`,
        asset.value,
        asset.status,
        asset.createdBy,
        asset.createdAt,
        `"${(asset.disposalReason || '').replace(/"/g, '""')}"`,
        asset.disposedBy || '',
        asset.disposedAt || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `asset_inventory_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['Title', 'Asset ID', 'Make', 'Serial Number', 'Value', 'Location'];
    const exampleRow = ['"Office Laptop"', 'AS-2023-001', 'Dell', 'SN12345', '1200', '"Room 101"'];
    const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'asset_import_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Helper to parse CSV line respecting quotes
  const parseCSVLine = (text: string) => {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '"') {
        inQuotes = !inQuotes;
      } else if (text[i] === ',' && !inQuotes) {
        let field = text.substring(start, i).trim();
        if (field.startsWith('"') && field.endsWith('"')) {
          field = field.slice(1, -1).replace(/""/g, '"');
        }
        result.push(field);
        start = i + 1;
      }
    }
    let lastField = text.substring(start).trim();
    if (lastField.startsWith('"') && lastField.endsWith('"')) {
      lastField = lastField.slice(1, -1).replace(/""/g, '"');
    }
    result.push(lastField);
    return result;
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length < 2) { // Need at least header + 1 row
        setImportFeedback({ success: 0, errors: ['File is empty or missing headers'] });
        return;
      }

      // Check headers
      const headers = parseCSVLine(lines[0].toLowerCase().trim());
      const requiredHeaders = ['title', 'asset id'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        setImportFeedback({ success: 0, errors: [`Missing required columns: ${missingHeaders.join(', ')}`] });
        return;
      }

      // Map indices
      const idx = {
        title: headers.indexOf('title'),
        make: headers.indexOf('make'),
        serialNumber: headers.indexOf('serial number'),
        assetId: headers.indexOf('asset id'),
        location: headers.indexOf('location'),
        value: headers.indexOf('value'),
      };

      let successCount = 0;
      const errors: string[] = [];

      // Process rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const row = parseCSVLine(line);
          const title = row[idx.title];
          const assetId = row[idx.assetId];

          if (!title || !assetId) {
            errors.push(`Row ${i + 1}: Missing Title or Asset ID`);
            continue;
          }

          await storageService.addAsset({
            title: title,
            assetId: assetId,
            make: idx.make !== -1 ? row[idx.make] || '' : '',
            serialNumber: idx.serialNumber !== -1 ? row[idx.serialNumber] || '' : '',
            location: idx.location !== -1 ? row[idx.location] || '' : '',
            value: idx.value !== -1 ? (parseFloat((row[idx.value] || '0').replace(/[^0-9.-]+/g, '')) || 0) : 0,
            createdBy: currentUser.username
          });
          successCount++;
        } catch (err: any) {
          errors.push(`Row ${i + 1}: ${err.message || 'Unknown error'}`);
        }
      }

      setImportFeedback({ success: successCount, errors });
      loadAssets(); // Refresh list
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleScanComplete = async (base64Image: string) => {
    setShowScanner(false);
    setIsAnalyzing(true);
    
    const result = await analyzeAssetImage(base64Image);
    
    setIsAnalyzing(false);
    
    if (result) {
      const suggestedAssetId = `AS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      setNewAsset({
        title: result.title || '',
        make: result.make || '',
        serialNumber: result.serialNumber || '',
        assetId: suggestedAssetId,
        location: result.location || '',
        value: result.value ? result.value.toString() : '',
      });
      setShowAddModal(true);
    } else {
      alert("Could not analyze image. Please try again or enter details manually.");
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.title || !newAsset.assetId) return;

    try {
      await storageService.addAsset({
        title: newAsset.title,
        make: newAsset.make,
        serialNumber: newAsset.serialNumber,
        assetId: newAsset.assetId,
        location: newAsset.location,
        value: parseFloat(newAsset.value) || 0,
        createdBy: currentUser.username,
      });
      
      setNewAsset({ title: '', make: '', serialNumber: '', assetId: '', location: '', value: '' });
      setShowAddModal(false);
      loadAssets();
    } catch (error: any) {
      console.error("Failed to add asset:", error);
      alert(`Error adding asset: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showDisposeModal && disposalReason) {
      try {
        await storageService.disposeAsset(showDisposeModal, disposalReason, currentUser.username);
        setShowDisposeModal(null);
        setDisposalReason('');
        loadAssets();
      } catch (error: any) {
        console.error("Failed to dispose asset:", error);
        alert(`Error disposing asset: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const filteredAssets = assets
    .filter(a => {
      if (filter === 'active') return a.status === AssetStatus.ACTIVE;
      if (filter === 'disposed') return a.status === AssetStatus.DISPOSED;
      return true;
    })
    .filter(a => 
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.assetId.toLowerCase().includes(search.toLowerCase()) ||
      a.serialNumber.toLowerCase().includes(search.toLowerCase())
    );

  const totalValue = useMemo(
    () => filteredAssets.reduce((sum, asset) => sum + (Number.isFinite(asset.value) ? asset.value : 0), 0),
    [filteredAssets]
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-gray-50/95 backdrop-blur border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm text-gray-600">
            Total Asset Value
          </div>
          <div className="text-xl font-semibold text-gray-900">
            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalValue)}
          </div>
        </div>
      </div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center space-x-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-md leading-5 placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="block w-full sm:w-auto py-2 px-3 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="disposed">Disposed Only</option>
          </select>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto flex-wrap gap-y-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowScanner(true)}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors text-sm font-medium"
          >
            <Camera className="w-4 h-4" />
            <span>Scan</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>New Asset</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
        {filteredAssets.map(asset => (
          <div key={asset.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${asset.status === AssetStatus.DISPOSED ? 'opacity-75 bg-gray-50' : 'border-gray-200'}`}>
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    {asset.title}
                  </h3>
                  <p className="text-sm text-gray-500">{asset.make}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  asset.status === AssetStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {asset.status.toUpperCase()}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <Hash className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="font-mono bg-gray-100 px-1 rounded text-xs">{asset.assetId}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="text-gray-500">SN: {asset.serialNumber}</span>
                </div>
                
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  {asset.location}
                </div>

                <div className="flex items-center text-gray-600">
                  <PoundSterling className="w-4 h-4 mr-2 text-gray-400" />
                  {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(asset.value)}
                </div>

                <div className="pt-3 mt-3 border-t border-gray-100 flex flex-col gap-1 text-xs text-gray-500">
                   <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1.5" />
                      Recorded {new Date(asset.createdAt).toLocaleDateString()} by <strong className="ml-1 text-gray-700">{asset.createdBy}</strong>
                   </div>
                   {asset.status === AssetStatus.DISPOSED && (
                     <div className="mt-2 bg-red-50 p-2 rounded text-red-700 border border-red-100">
                       <p className="font-medium flex items-center mb-1">
                         <Trash2 className="w-3 h-3 mr-1" />
                         Disposed by {asset.disposedBy}
                       </p>
                       <p>Reason: {asset.disposalReason}</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
            
            {currentUser.role === UserRole.ADMIN && asset.status === AssetStatus.ACTIVE && (
              <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowDisposeModal(asset.id)}
                  className="text-red-600 hover:text-red-900 text-sm font-medium hover:underline flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Dispose Item
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {filteredAssets.length === 0 && (
         <div className="text-center py-12">
           <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
             <AlertCircle className="w-8 h-8 text-gray-400" />
           </div>
           <h3 className="text-lg font-medium text-gray-900">No assets found</h3>
           <p className="mt-1 text-gray-500">Get started by adding a new item to the inventory.</p>
         </div>
      )}

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Record New Asset
                    </h3>
                    {/* Visual indicator if AI was used */}
                    {newAsset.title && newAsset.make && (
                       <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                         <Sparkles className="w-3 h-3 mr-1" /> AI Filled
                       </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <form onSubmit={handleAddAsset} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Equipment Title</label>
                        <input type="text" required className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                          value={newAsset.title} onChange={e => setNewAsset({...newAsset, title: e.target.value})} placeholder="e.g. Dell Latitude 5420" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Make/Manufacturer</label>
                          <input type="text" required className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                            value={newAsset.make} onChange={e => setNewAsset({...newAsset, make: e.target.value})} placeholder="Dell" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Serial Number</label>
                          <input type="text" required className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                            value={newAsset.serialNumber} onChange={e => setNewAsset({...newAsset, serialNumber: e.target.value})} placeholder="8H29X..." />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-medium text-gray-700">Asset ID</label>
                           <input type="text" required className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                             value={newAsset.assetId} onChange={e => setNewAsset({...newAsset, assetId: e.target.value})} placeholder="AS-2023-001" />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-gray-700">Value (£)</label>
                           <input type="number" step="0.01" required className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                             value={newAsset.value} onChange={e => setNewAsset({...newAsset, value: e.target.value})} placeholder="1200.00" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Location</label>
                        <input type="text" required className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                          value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} placeholder="Building A, Room 304" />
                      </div>
                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                          Save Record
                        </button>
                        <button type="button" onClick={() => setShowAddModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full sm:p-6">
              <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <FileSpreadsheet className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Bulk Import Assets</h3>
                 </div>
                 <button onClick={() => { setShowImportModal(false); setImportFeedback(null); }} className="text-gray-400 hover:text-gray-500">
                   <X className="w-6 h-6" />
                 </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">CSV Format Instructions</h4>
                  <p className="text-sm text-gray-600 mb-2">The file must include a header row with the following columns (case-insensitive):</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                    <li><strong>Title</strong> (Required)</li>
                    <li><strong>Asset ID</strong> (Required, unique)</li>
                    <li>Make</li>
                    <li>Serial Number</li>
                    <li>Value (Number only)</li>
                    <li>Location</li>
                  </ul>
                  <div className="mt-3 p-2 bg-white border border-gray-200 rounded text-xs font-mono text-gray-500 overflow-x-auto">
                    Title,Make,Serial Number,Asset ID,Value,Location<br/>
                    "Office Laptop",Dell,SN12345,AS-2023-001,1200,Room 101<br/>
                    Projector,Epson,,AS-2023-002,500,Conference Room
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={handleDownloadTemplate}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center font-medium"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download CSV Template
                    </button>
                  </div>
                </div>

                {importFeedback && (
                  <div className={`p-4 rounded-md ${importFeedback.success > 0 && importFeedback.errors.length === 0 ? 'bg-green-50 text-green-800' : 'bg-gray-50'}`}>
                    <div className="flex items-center mb-2">
                       <CheckCircle className={`w-5 h-5 mr-2 ${importFeedback.success > 0 ? 'text-green-500' : 'text-gray-400'}`} />
                       <span className="font-medium">Import Results</span>
                    </div>
                    <p className="text-sm">Successfully imported: <strong>{importFeedback.success}</strong> assets.</p>
                    {importFeedback.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-700 mb-1">Errors ({importFeedback.errors.length}):</p>
                        <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded text-xs text-red-600 space-y-1">
                          {importFeedback.errors.map((err, idx) => (
                            <div key={idx}>{err}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-3 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-gray-500">CSV files only</p>
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" accept=".csv" onChange={handleImportFile} />
                  </label>
                </div>
              </div>

              <div className="mt-5 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setImportFeedback(null); }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispose Modal */}
      {showDisposeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Dispose Asset
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to dispose of this asset? It will remain in the database but marked as disposed.
                    </p>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700">Reason for disposal</label>
                      <textarea
                        required
                        rows={3}
                        className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        placeholder="e.g. Broken beyond repair, Obsolete, Sold..."
                        value={disposalReason}
                        onChange={(e) => setDisposalReason(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDispose}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Confirm Disposal
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisposeModal(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {showScanner && (
        <CameraCapture 
          onCapture={handleScanComplete} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      {/* Analyzing Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center max-w-sm w-full mx-4">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Analyzing with Gemini AI</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              Identifying asset details, estimating value, and suggesting location...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
