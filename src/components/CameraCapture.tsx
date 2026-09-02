import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Note } from './ui'

/* ---------------------------------------------------------------------------
   Live camera capture.

   `<input capture>` only opens a camera on mobile; on a laptop the attribute is
   ignored and you get a file picker, which is why "use camera" felt broken.
   This opens a real getUserMedia preview, center-crops the frame to a square
   and hands back a JPEG data URI. It falls back to the file input whenever the
   browser cannot give us a stream.
--------------------------------------------------------------------------- */

type Status = 'starting' | 'live' | 'error'

interface CameraError {
  title: string
  detail: string
  recoverable: boolean
}

const secureContext = () =>
  typeof window !== 'undefined' &&
  (window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1')

function describe(err: unknown): CameraError {
  const name = err instanceof Error ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        title: 'Camera permission was declined.',
        detail:
          'Allow camera access for this site in your browser’s address bar, then try again. You can also choose a saved image instead.',
        recoverable: true,
      }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        title: 'No camera was found on this device.',
        detail: 'Connect a fundus camera or webcam, or choose a saved image instead.',
        recoverable: true,
      }
    case 'NotReadableError':
      return {
        title: 'The camera is in use by another application.',
        detail: 'Close any other app using the camera and try again.',
        recoverable: true,
      }
    default:
      return {
        title: 'The camera could not be started.',
        detail: 'Choose a saved image instead, or try again.',
        recoverable: true,
      }
  }
}

export function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (dataUrl: string, label: string) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<Status>('starting')
  const [error, setError] = useState<CameraError | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | undefined>()

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(
    async (preferred?: string) => {
      setStatus('starting')
      setError(null)

      if (!secureContext()) {
        setError({
          title: 'Cameras need a secure connection.',
          detail:
            'Browsers only expose a camera over https or on localhost. Open the prototype at http://localhost:5173, or choose a saved image.',
          recoverable: false,
        })
        setStatus('error')
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError({
          title: 'This browser cannot open a camera.',
          detail: 'Choose a saved image instead.',
          recoverable: false,
        })
        setStatus('error')
        return
      }

      stop()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: preferred
            ? { deviceId: { exact: preferred }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('live')

        // Labels are only populated once permission has been granted.
        const all = await navigator.mediaDevices.enumerateDevices()
        const cams = all.filter((d) => d.kind === 'videoinput')
        setDevices(cams)
        const active = stream.getVideoTracks()[0]?.getSettings().deviceId
        setDeviceId(preferred ?? active)
      } catch (err) {
        setError(describe(err))
        setStatus('error')
      }
    },
    [stop],
  )

  useEffect(() => {
    void start()
    return stop
  }, [start, stop])

  const shoot = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const side = Math.min(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(side, 1200)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    stop()
    onCapture(canvas.toDataURL('image/jpeg', 0.92), 'Camera capture')
  }

  return (
    <div>
      <div className="relative aspect-square w-full bg-[#080603] overflow-hidden hairline">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {status === 'live' && (
          <>
            {/* Alignment guide: the retina should fill the ring. */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden>
              <circle cx="50" cy="50" r="42" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.4" />
              <circle cx="50" cy="50" r="3" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.4" />
              {[
                [50, 4, 50, 11],
                [50, 89, 50, 96],
                [4, 50, 11, 50],
                [89, 50, 96, 50],
              ].map(([x1, y1, x2, y2], i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeOpacity="0.6" strokeWidth="0.5" />
              ))}
            </svg>
            <p className="absolute inset-x-0 bottom-0 m-0 px-3 py-2 text-[12px] text-white/85 bg-black/45">
              Fill the ring with the retina and keep the optic disc inside the frame.
            </p>
          </>
        )}

        {status === 'starting' && (
          <p className="absolute inset-0 flex items-center justify-center text-[13px] text-white/70 m-0">
            Starting the camera…
          </p>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm w-full">
              <Note tone="alert" title={error?.title}>
                {error?.detail}
              </Note>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button variant="primary" onClick={shoot} disabled={status !== 'live'}>
          Capture frame
        </Button>
        {status === 'error' && error?.recoverable && (
          <Button onClick={() => void start(deviceId)}>Try again</Button>
        )}
        <Button onClick={onCancel}>Cancel</Button>

        {devices.length > 1 && (
          <label className="flex items-center gap-2 ml-auto">
            <span className="label">Camera</span>
            <select
              value={deviceId ?? ''}
              onChange={(e) => void start(e.target.value)}
              className="min-h-10 px-2 bg-surface border border-line rounded-control text-[13px] max-w-52"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  )
}
