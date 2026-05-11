export default function SaveErrorBox({ error, userId }) {
  if (!error) return null
  return (
    <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-700 space-y-1 break-all">
      <p className="font-bold">⚠ 저장 실패 — 이 화면을 캡처해서 공유해주세요</p>
      {userId && <p><span className="font-semibold">사용자:</span> {userId}</p>}
      <p><span className="font-semibold">시각:</span> {new Date().toISOString()}</p>
      <p><span className="font-semibold">코드:</span> {error.code ?? '—'}</p>
      <p><span className="font-semibold">메시지:</span> {error.message ?? String(error)}</p>
      {error.details && <p><span className="font-semibold">상세:</span> {error.details}</p>}
      {error.hint && <p><span className="font-semibold">힌트:</span> {error.hint}</p>}
    </div>
  )
}
