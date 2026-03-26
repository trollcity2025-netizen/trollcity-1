import React, {useRef, useState, useEffect} from 'react'
import Tesseract from 'tesseract.js'
import * as faceapi from 'face-api.js'
import {supabase} from '../lib/supabase'
import {sendNotification} from '../lib/sendNotification'

type Result = {
  ocrText?: string
  matchScore?: number
  status: 'verified' | 'needs_review' | 'failed'
}

export default function IdVerifyClient({onComplete}:{onComplete:(r:Result)=>void}){
  const videoRef = useRef<HTMLVideoElement|null>(null)
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const [idFile, setIdFile] = useState<File|null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    async function loadModels(){
      try{
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models')
      }catch(e){
        console.error('failed to load faceapi models', e)
      }
    }
    loadModels()
  },[])

  async function startCamera(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({video:true})
      if(videoRef.current) videoRef.current.srcObject = stream
    }catch(e){
      console.error('camera error', e)
    }
  }

  function handleIdFileChange(e:React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files && e.target.files[0]
    if(f) setIdFile(f)
  }

  async function captureSelfie():Promise<Blob|null>{
    if(!videoRef.current || !canvasRef.current) return null
    const v = videoRef.current
    const c = canvasRef.current
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(v,0,0,c.width,c.height)
    return await new Promise<Blob|null>(res=> c.toBlob(b=> res(b)) )
  }

  async function runOcr(file:File){
    const { data: { text } } = await Tesseract.recognize(file, 'eng')
    return text
  }

  async function runFaceMatch(idBlob:Blob, selfieBlob:Blob){
    try{
      const idImg = await faceapi.bufferToImage(idBlob)
      const selfieImg = await faceapi.bufferToImage(selfieBlob)
      const idDet = await faceapi.detectSingleFace(idImg).withFaceLandmarks().withFaceDescriptor()
      const selfieDet = await faceapi.detectSingleFace(selfieImg).withFaceLandmarks().withFaceDescriptor()
      if(!idDet || !selfieDet) return null
      const dist = faceapi.euclideanDistance(idDet.descriptor, selfieDet.descriptor)
      const score = Math.max(0, 1 - dist)
      return score
    }catch(e){
      console.error('face match error', e)
      return null
    }
  }

  async function uploadAndNotify(ocrText:string|null, matchScore:number|null, idBlob:Blob, selfieBlob:Blob, status:'verified'|'needs_review'|'failed'){
    setLoading(true)
    try{
      const uid = (await supabase.auth.getUser()).data.user?.id
      if(!uid) throw new Error('not authenticated')

      const idPath = `verification_docs/${uid}/id.jpg`
      const selfiePath = `verification_docs/${uid}/selfie.jpg`
      await supabase.storage.from('verification_docs').upload(idPath, idBlob, {upsert:true})
      await supabase.storage.from('verification_docs').upload(selfiePath, selfieBlob, {upsert:true})
      const { data: idUrl } = await supabase.storage.from('verification_docs').getPublicUrl(idPath)
      const { data: selfieUrl } = await supabase.storage.from('verification_docs').getPublicUrl(selfiePath)

      await supabase.from('user_profiles').upsert({
        user_id: uid,
        id_document_url: idUrl.publicUrl,
        id_selfie_url: selfieUrl.publicUrl,
        id_verification_status: status,
        id_verification_ocr: ocrText || null,
        id_verification_score: matchScore || null,
      })

      if(status === 'needs_review' || status === 'failed'){
        await sendNotification(
          uid,
          'system',
          'ID Verification Review',
          'New ID verification requires review',
          { ocr: ocrText, score: matchScore }
        )
      }
    }catch(e){
      console.error('upload error', e)
    }finally{
      setLoading(false)
    }
  }

  async function handleRun(){
    if(!idFile){
      alert('Please select an ID file first')
      return
    }
    setLoading(true)
    try{
      const selfieBlob = await captureSelfie()
      if(!selfieBlob) throw new Error('failed selfie')
      const ocrText = await runOcr(idFile)
      const matchScore = await runFaceMatch(idFile, selfieBlob as Blob)

      let status:'verified'|'needs_review'|'failed' = 'needs_review'
      if(matchScore !== null){
        if(matchScore > 0.75) status = 'verified'
        else if(matchScore > 0.45) status = 'needs_review'
        else status = 'failed'
      }

      await uploadAndNotify(ocrText, matchScore || null, idFile as Blob, selfieBlob as Blob, status)
      onComplete({ocrText, matchScore: matchScore||0, status})
    }catch(e){
      console.error(e)
      onComplete({status:'failed'})
    }finally{setLoading(false)}
  }

  return (
    <div className="p-4 bg-slate-900 rounded shadow border border-white/10">
      <h3 className="text-lg font-semibold text-white">ID Verification (Prototype)</h3>
      <p className="text-sm text-gray-400">Capture a photo of your ID and a live selfie. OCR and face-match run locally.</p>
      <div className="mt-3">
        <label className="block text-sm">ID Image (photo or scan)</label>
        <input type="file" accept="image/*" onChange={handleIdFileChange} />
      </div>

      <div className="mt-3">
        <label className="block text-sm">Selfie (live)</label>
        <video ref={videoRef} autoPlay muted playsInline className="w-64 h-48 bg-black" />
        <canvas ref={canvasRef} style={{display:'none'}} />
        <div className="mt-2">
          <button className="btn" onClick={startCamera}>Start Camera</button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button className="btn-primary" onClick={handleRun} disabled={loading}>{loading? 'Running...':'Run Verification'}</button>
      </div>
    </div>
  )
}
