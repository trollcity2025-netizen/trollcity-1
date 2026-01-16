import React, { useEffect, useRef } from 'react'
import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4, FreeCamera } from '@babylonjs/core'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const ChurchPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new Engine(canvasRef.current, true)
    const scene = new Scene(engine)

    // Lighting
    new HemisphericLight('light', new Vector3(0, 1, 0), scene)
    scene.clearColor = new Color4(0.1, 0.05, 0.05, 1)

    // Camera (Fixed Pew Cam)
    // "Camera is seated at pew height... Facing forward toward the pulpit/stage"
    const camera = new FreeCamera('pewCam', new Vector3(0, 1.2, -5), scene)
    camera.setTarget(new Vector3(0, 1.5, 10)) // Look at pulpit
    // Disable controls for "Fixed" feel, or allow slight look
    camera.attachControl(canvasRef.current, true)
    camera.inputs.clear() // Remove all inputs to make it fixed

    // Simple Interior Geometry
    const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 30 }, scene)
    const groundMat = new StandardMaterial('groundMat', scene)
    groundMat.diffuseColor = new Color3(0.3, 0.2, 0.1) // Wood floor
    ground.material = groundMat

    // Pulpit / Stage
    const stage = MeshBuilder.CreateBox('stage', { width: 8, height: 1, depth: 4 }, scene)
    stage.position = new Vector3(0, 0.5, 10)
    const stageMat = new StandardMaterial('stageMat', scene)
    stageMat.diffuseColor = new Color3(0.5, 0.1, 0.1) // Red carpet
    stage.material = stageMat

    // Pews (Rows of boxes)
    for (let z = 0; z > -10; z -= 2) {
        const pewL = MeshBuilder.CreateBox(`pewL_${z}`, { width: 6, height: 0.5, depth: 0.8 }, scene)
        pewL.position = new Vector3(-4, 0.25, z)
        
        const pewR = MeshBuilder.CreateBox(`pewR_${z}`, { width: 6, height: 0.5, depth: 0.8 }, scene)
        pewR.position = new Vector3(4, 0.25, z)
    }

    // Render Loop
    engine.runRenderLoop(() => {
        scene.render()
    })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
        window.removeEventListener('resize', handleResize)
        engine.dispose()
    }
  }, [])

  return (
    <div className="relative w-full h-screen bg-black">
        <canvas ref={canvasRef} className="w-full h-full outline-none" />
        
        {/* Overlay UI */}
        <div className="absolute top-4 left-4">
            <button 
                onClick={() => navigate('/trolls-town')}
                className="flex items-center gap-2 px-4 py-2 bg-black/60 text-white rounded-lg hover:bg-black/80"
            >
                <ArrowLeft size={16} />
                Exit Church
            </button>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center">
            <h1 className="text-2xl font-bold text-yellow-500 mb-1">Sunday Service</h1>
            <p className="text-gray-300 text-sm">You are seated in the audience.</p>
        </div>
    </div>
  )
}

export default ChurchPage
