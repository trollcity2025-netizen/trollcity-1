import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { 
  Image as ImageIcon, 
  Trash2, 
  Upload, 
  RefreshCw, 
  ExternalLink, 
  Folder,
  Loader2,
  X,
  Copy
} from 'lucide-react'

// Define the buckets we want to manage
const BUCKETS = [
  { id: 'avatars', label: 'Avatars' },
  { id: 'covers', label: 'Cover Photos' },
  { id: 'chat-media', label: 'Chat Media' },
  { id: 'troll-city-assets', label: 'Assets' },
  { id: 'public', label: 'Public' }
]

interface FileObject {
  name: string
  id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  metadata: Record<string, any>
}

export default function MediaLibrary() {
  const [activeBucket, setActiveBucket] = useState<string>('avatars')
  const [files, setFiles] = useState<FileObject[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileObject | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    setFiles([])
    setSelectedFile(null)
    setPreviewUrl(null)

    try {
      const { data, error } = await supabase.storage
        .from(activeBucket)
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (error) {
        // If bucket doesn't exist or permission denied, handle gracefully
        console.warn(`Error loading bucket ${activeBucket}:`, error)
        // toast.error(`Failed to load ${activeBucket}: ${error.message}`)
      } else {
        setFiles(data || [])
      }
    } catch (err: any) {
      console.error('Unexpected error loading files:', err)
      toast.error('Unexpected error loading files')
    } finally {
      setLoading(false)
    }
  }, [activeBucket])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return
    
    const file = event.target.files[0]
    setUploading(true)

    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
      const filePath = fileName

      const { error } = await supabase.storage
        .from(activeBucket)
        .upload(filePath, file)

      if (error) throw error

      toast.success('File uploaded successfully')
      loadFiles()
    } catch (error: any) {
      console.error('Error uploading file:', error)
      toast.error(`Upload failed: ${error.message}`)
    } finally {
      setUploading(false)
      // Reset input
      event.target.value = ''
    }
  }

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return

    try {
      const { error } = await supabase.storage
        .from(activeBucket)
        .remove([fileName])

      if (error) throw error

      toast.success('File deleted')
      setFiles(prev => prev.filter(f => f.name !== fileName))
      if (selectedFile?.name === fileName) {
        setSelectedFile(null)
        setPreviewUrl(null)
      }
    } catch (error: any) {
      console.error('Error deleting file:', error)
      toast.error(`Delete failed: ${error.message}`)
    }
  }

  const handleSelectFile = (file: FileObject) => {
    setSelectedFile(file)
    const { data } = supabase.storage
      .from(activeBucket)
      .getPublicUrl(file.name)
    setPreviewUrl(data.publicUrl)
  }

  const copyUrl = () => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl)
      toast.success('URL copied to clipboard')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Folder className="w-8 h-8 text-purple-400" />
              Media Library
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage application assets and user uploads
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={loadFiles}
              disabled={loading}
              className="p-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg cursor-pointer transition-colors font-medium">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload File'}
              <input 
                type="file" 
                className="hidden" 
                onChange={handleUpload}
                disabled={uploading}
                accept="image/*,video/*,audio/*"
              />
            </label>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex gap-6 overflow-hidden bg-[#141414] border border-[#2C2C2C] rounded-xl">
          {/* Sidebar - Buckets */}
          <div className="w-64 bg-[#0A0814] border-r border-[#2C2C2C] p-4 flex flex-col gap-1 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">
              Buckets
            </h3>
            {BUCKETS.map(bucket => (
              <button
                key={bucket.id}
                onClick={() => setActiveBucket(bucket.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeBucket === bucket.id
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'text-gray-400 hover:bg-[#1A1A1A] hover:text-gray-200'
                }`}
              >
                <Folder className={`w-4 h-4 ${activeBucket === bucket.id ? 'fill-current' : ''}`} />
                {bucket.label}
              </button>
            ))}
          </div>

          {/* File Grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-purple-500" />
                <p>Loading files...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
                <p>No files found in this bucket</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map(file => (
                  <div 
                    key={file.id}
                    onClick={() => handleSelectFile(file)}
                    className={`group relative aspect-square bg-[#0A0814] border rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectedFile?.id === file.id
                        ? 'border-purple-500 ring-2 ring-purple-500/20'
                        : 'border-[#2C2C2C] hover:border-gray-500'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-full flex items-center justify-center bg-[#1A1A1A]">
                      {file.metadata?.mimetype?.startsWith('image/') ? (
                        <img 
                          src={supabase.storage.from(activeBucket).getPublicUrl(file.name).data.publicUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-gray-500 flex flex-col items-center">
                          <ImageIcon className="w-8 h-8 mb-1" />
                          <span className="text-[10px] uppercase">{file.name.split('.').pop()}</span>
                        </div>
                      )}
                    </div>

                    {/* Overlay Info */}
                    <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 transform translate-y-full group-hover:translate-y-0 transition-transform">
                      <p className="text-xs text-white truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {(file.metadata?.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Sidebar */}
          {selectedFile && (
            <div className="w-80 bg-[#0A0814] border-l border-[#2C2C2C] p-6 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">File Details</h3>
                <button 
                  onClick={() => {
                    setSelectedFile(null)
                    setPreviewUrl(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#1A1A1A] rounded-lg border border-[#2C2C2C] overflow-hidden mb-4">
                {previewUrl && (
                  <div className="aspect-square flex items-center justify-center bg-black/50">
                     {selectedFile.metadata?.mimetype?.startsWith('image/') ? (
                        <img 
                          src={previewUrl} 
                          alt={selectedFile.name} 
                          className="max-w-full max-h-full object-contain"
                        />
                     ) : (
                        <ImageIcon className="w-16 h-16 text-gray-600" />
                     )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Filename</label>
                  <p className="text-sm text-gray-200 break-all">{selectedFile.name}</p>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Size</label>
                  <p className="text-sm text-gray-200">
                    {(selectedFile.metadata?.size / 1024).toFixed(2)} KB
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Type</label>
                  <p className="text-sm text-gray-200">
                    {selectedFile.metadata?.mimetype || 'Unknown'}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Uploaded</label>
                  <p className="text-sm text-gray-200">
                    {new Date(selectedFile.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#2C2C2C] space-y-2">
                  <button 
                    onClick={copyUrl}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg text-sm font-medium transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Public URL
                  </button>

                  <a 
                    href={previewUrl || '#'} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg text-sm font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in New Tab
                  </a>

                  <button 
                    onClick={() => handleDelete(selectedFile.name)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg text-sm font-medium transition-colors mt-4"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
