const PATHS = {
  gateway: (
    <>
      <path d="M2 6.5 8 2l6 4.5" />
      <path d="M3 6.5V13h10V6.5" />
      <path d="M6.5 13V9h3v4" />
    </>
  ),
  entity: (
    <>
      <rect x="2.5" y="4.5" width="11" height="8.5" rx="0.5" />
      <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
      <path d="M2.5 8h11" />
    </>
  ),
  pool: (
    <>
      <circle cx="5.5" cy="6" r="2" />
      <circle cx="10.5" cy="6" r="2" />
      <circle cx="8" cy="10.5" r="2" />
    </>
  ),
  shell: (
    <>
      <path d="M2 10V6.5L5 5h4l3 1.5V10" />
      <path d="M2 10h12" />
      <circle cx="5" cy="11.5" r="1.2" />
      <circle cx="11" cy="11.5" r="1.2" />
    </>
  ),
  comm: (
    <>
      <path d="M8 2v3" />
      <circle cx="8" cy="6.5" r="1.5" />
      <path d="M4 13c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5" />
      <path d="M2 13h12" />
    </>
  ),
  individual: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 14c0-3 2.2-5 5-5s5 2 5 5" />
    </>
  ),
  fiduciary: (
    <>
      <path d="M8 2v11" />
      <path d="M3 5h10" />
      <path d="M3 5 1.5 8.5h3L3 5Z" />
      <path d="M13 5l-1.5 3.5h3L13 5Z" />
      <path d="M5 14h6" />
    </>
  ),
  clearing: (
    <>
      <path d="M2 5.5h9" />
      <path d="M8.5 3l2.5 2.5L8.5 8" />
      <path d="M14 10.5H5" />
      <path d="M7.5 8l-2.5 2.5L7.5 13" />
    </>
  ),
}

function EntityIcon({ type, className }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[type] || PATHS.entity}
    </svg>
  )
}

export default EntityIcon
