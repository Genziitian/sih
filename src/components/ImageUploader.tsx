import { useRef, useState } from 'react'
import type { EyeSide } from '../types'
import { CAPTURE_DEMO_IDS, demoCase } from '../demo/cases'
import { resolveFundusSrc, specToUrl } from '../demo/fundus'
import { CameraCapture } from './CameraCapture'
import { Button } from './ui'

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function ImageUploader({
  side,
  onPick,
}: {
  side: EyeSide
  onPick: (src: string, label: string, demoCaseId?: string) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState<string | null>(null)
  const [camera, setCamera] = useState(false)

  const accept = async (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(jpeg|png|jpg|webp)$/.test(file.type)) {
      setRejected('That file is not a JPG or PNG image.')
      return
    }
    setRejected(null)
    onPick(await readFile(file), file.name)
  }

  if (camera) {
    return (
      <CameraCapture
        onCapture={(src, label) => {
          setCamera(false)
          onPick(src, label)
        }}
        onCancel={() => setCamera(false)}
      />
    )
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void accept(e.dataTransfer.files[0])
        }}
        className={[
          'aspect-square w-full flex flex-col items-center justify-center text-center gap-3 px-6',
          'border border-dashed bg-surface',
          dragging ? 'border-primary bg-primary-wash' : 'border-line',
        ].join(' ')}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
          <circle cx="22" cy="22" r="15" stroke="var(--color-muted)" strokeWidth="1.5" />
          <circle cx="28" cy="22" r="4.5" stroke="var(--color-muted)" strokeWidth="1.5" />
          <path d="M13 22c3-6 8-6 11 0" stroke="var(--color-muted)" strokeWidth="1.5" />
        </svg>
        <div>
          <p className="text-[15px] m-0">Capture or drop the {side} eye fundus image here</p>
          <p className="label mt-1">JPG or PNG. Both eyes needed for a complete screening.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button variant="primary" onClick={() => fileInput.current?.click()}>
            Choose image
          </Button>
          <Button onClick={() => setCamera(true)}>Use camera</Button>
        </div>
        {rejected && <p className="text-[13px] text-alert m-0">{rejected}</p>}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => void accept(e.target.files?.[0] ?? undefined)}
        />
      </div>

      <div className="mt-3">
        <p className="label mb-2">
          No camera to hand? Use a demo image — each one takes a different path.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {CAPTURE_DEMO_IDS.map((id) => {
            const c = demoCase(id)!
            const url = specToUrl({ seed: c.seed, side, flavour: c.flavour, counts: c.counts })
            return (
              <button
                key={id}
                onClick={() => onPick(url, `Demo — ${c.title}`, id)}
                className="text-left group"
                title={c.blurb}
              >
                <img
                  src={resolveFundusSrc(url)}
                  alt=""
                  className="w-full aspect-square object-cover hairline group-hover:border-primary"
                />
                <span className="label block mt-1 leading-tight group-hover:text-ink">
                  {c.title.split(' — ')[0]}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
