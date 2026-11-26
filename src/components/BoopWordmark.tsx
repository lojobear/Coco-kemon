/** Secret Spark — custom Figma vector lettering, not a font or remote asset. */
export function BoopWordmark({dark=false}:{dark?:boolean}){
  return <svg className="boop-secret-wordmark" aria-hidden="true" focusable="false" viewBox="0 0 334 154" width="66" height="31" style={{display:'block',flexShrink:0,maxWidth:'100%'}}>
    <g fill={dark?'#ffffff':'#202323'} fillRule="evenodd">
      <path d="M0 16 Q0 4 12 4 H16 Q28 4 28 16 V43 C35 38 43 36 51 36 C73 36 84 53 84 77 C84 102 68 118 45 118 C20 118 0 101 0 77 Z M45 60 A17 17 0 1 0 45 94 A17 17 0 1 0 45 60 Z"/>
      <path d="M167 48 C158 40 145 36 131 36 C107 36 90 53 90 77 C90 101 107 118 131 118 C145 118 158 114 167 106 C176 114 189 118 203 118 C227 118 244 101 244 77 C244 53 227 36 203 36 C189 36 176 40 167 48 Z M131 60 A17 17 0 1 0 131 94 A17 17 0 1 0 131 60 Z M203 60 A17 17 0 1 0 203 94 A17 17 0 1 0 203 60 Z M167 63 Q169 75 179 77 Q169 79 167 91 Q165 79 155 77 Q165 75 167 63 Z"/>
      <path transform="translate(250 154) scale(1 -1)" d="M0 16 Q0 4 12 4 H16 Q28 4 28 16 V43 C35 38 43 36 51 36 C73 36 84 53 84 77 C84 102 68 118 45 118 C20 118 0 101 0 77 Z M45 60 A17 17 0 1 0 45 94 A17 17 0 1 0 45 60 Z"/>
    </g>
  </svg>;
}
