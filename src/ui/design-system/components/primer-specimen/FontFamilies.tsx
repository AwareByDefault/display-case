/**
 * Display Case — FontFamilies
 * A stack of font-family rows: a mono tag, a large sample set in the family, and
 * a mono note listing the stack. Generic specimen primitive for a Primer — use
 * it to document a type pairing (a UI sans, a code mono, …).
 */

export interface FontFamily {
  /** Mono uppercase tag (e.g. `Sans · UI`); also the React key. */
  tag: string
  /** Large sample, rendered in this family. */
  sample: string
  /** Mono note under the sample — typically the font stack. */
  note?: string
  /** Render the sample in the mono family instead of the sans family. */
  mono?: boolean
}

export interface FontFamiliesProps {
  families: FontFamily[]
}

export function FontFamilies({ families }: FontFamiliesProps) {
  return (
    <div className="dcpl-fam">
      {families.map((f) => (
        <div className="dcpl-famrow" key={f.tag}>
          <div className="dcpl-famtag">{f.tag}</div>
          <div>
            <div
              className="dcpl-famsample"
              data-font={f.mono ? 'mono' : 'sans'}>
              {f.sample}
            </div>
            {f.note ? <div className="dcpl-famnote">{f.note}</div> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
