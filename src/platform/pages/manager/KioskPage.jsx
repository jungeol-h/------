// 등·하원 키오스크 — 센터 공용 태블릿용 전체화면 (Header/TabBar 없음).
// 학생이 전화번호 뒷 4자리 입력 → 본인 이름 확인 → 등원/하원.
// 지각·조퇴 판정은 서버 RPC가 DB 시각으로 한다. 여기서는 입력·표시만.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Delete, X, LogIn, LogOut, CheckCircle2, AlertCircle, Loader } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'

const RESET_DELAY_MS = 3000

// RPC 결과 → 결과 화면 문구
function checkInMessage(student, { result, corrected, noSchedule }) {
  if (result === 'already_in') return { tone: 'info', text: `${student.name}님은 이미 등원 처리되어 있어요` }
  if (corrected) return { tone: 'warn', text: `${student.name}님 등원 완료 · 지각 (자동결석 정정)` }
  if (result === 'late') return { tone: 'warn', text: `${student.name}님 등원 완료 · 지각` }
  if (noSchedule) return { tone: 'ok', text: `${student.name}님 등원 완료 (오늘 등원 예정 없음)` }
  return { tone: 'ok', text: `${student.name}님 등원 완료` }
}

function checkOutMessage(student, { result }) {
  if (result === 'no_check_in') return { tone: 'error', text: '등원 기록이 없어 하원 처리할 수 없어요' }
  if (result === 'early_leave') return { tone: 'warn', text: `${student.name}님 하원 완료 · 조퇴 처리` }
  return { tone: 'ok', text: `${student.name}님 하원 완료` }
}

const TONE_STYLES = {
  ok: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-yellow-50 text-yellow-700',
  info: 'bg-blue-50 text-blue-700',
  error: 'bg-red-50 text-red-700',
}

export default function KioskPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { kioskFindStudents, kioskCheckIn, kioskCheckOut } = useData()
  // /admin/kiosk와 /manager/kiosk 양쪽에 마운트된다 — 종료 시 각자 대시보드로
  const exitTo = pathname.startsWith('/admin') ? '/admin/home' : '/manager/attendance'

  // step: input → select → result
  const [digits, setDigits] = useState('')
  const [step, setStep] = useState('input')
  const [candidates, setCandidates] = useState([])
  const [message, setMessage] = useState(null) // { tone, text }
  const [busy, setBusy] = useState(false)
  const resetTimer = useRef(null)

  const reset = useCallback(() => {
    clearTimeout(resetTimer.current)
    setDigits('')
    setStep('input')
    setCandidates([])
    setMessage(null)
    setBusy(false)
  }, [])

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  const showResult = (msg) => {
    setMessage(msg)
    setStep('result')
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(reset, RESET_DELAY_MS)
  }

  const search = async (fourDigits) => {
    setBusy(true)
    try {
      const found = await kioskFindStudents(fourDigits)
      if (found.length === 0) {
        showResult({ tone: 'error', text: '해당 번호의 학생이 없어요. 다시 확인해 주세요.' })
      } else {
        setCandidates(found)
        setStep('select')
      }
    } catch {
      showResult({ tone: 'error', text: '조회에 실패했어요. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setBusy(false)
    }
  }

  const pressDigit = (d) => {
    if (busy || step !== 'input') return
    const next = (digits + d).slice(0, 4)
    setDigits(next)
    if (next.length === 4) search(next)
  }

  const handleCheckIn = async (student) => {
    if (busy) return
    setBusy(true)
    try {
      const res = await kioskCheckIn(student.id)
      showResult(checkInMessage(student, res))
    } catch {
      showResult({ tone: 'error', text: '처리에 실패했어요. 다시 시도해 주세요.' })
    } finally {
      setBusy(false)
    }
  }

  const handleCheckOut = async (student) => {
    if (busy) return
    setBusy(true)
    try {
      const res = await kioskCheckOut(student.id)
      showResult(checkOutMessage(student, res))
    } catch {
      showResult({ tone: 'error', text: '처리에 실패했어요. 다시 시도해 주세요.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-8 select-none">
      {/* 교직원용 나가기 — 학생 눈에 안 띄게 작게 */}
      <button
        onClick={() => navigate(exitTo)}
        className="fixed top-3 right-3 text-gray-300 hover:text-gray-500 p-2"
        aria-label="키오스크 종료"
      >
        <X size={20} />
      </button>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">등·하원 체크</h1>
          <p className="text-sm text-gray-500 mt-1">전화번호 뒷 4자리를 눌러 주세요</p>
        </div>

        {/* 입력 표시 */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold ${
                digits[i] ? 'border-indigo-400 bg-white text-gray-900' : 'border-gray-200 bg-white text-gray-300'
              }`}
            >
              {digits[i] ?? ''}
            </div>
          ))}
        </div>

        {step === 'input' && (
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                onClick={() => pressDigit(d)}
                className="h-20 bg-white rounded-2xl shadow-sm text-3xl font-bold text-gray-800 active:scale-95 active:bg-indigo-50 transition-all"
              >
                {d}
              </button>
            ))}
            <button
              onClick={reset}
              className="h-20 bg-white rounded-2xl shadow-sm text-base font-semibold text-gray-400 active:scale-95 transition-all"
            >
              전체 지움
            </button>
            <button
              onClick={() => pressDigit('0')}
              className="h-20 bg-white rounded-2xl shadow-sm text-3xl font-bold text-gray-800 active:scale-95 active:bg-indigo-50 transition-all"
            >
              0
            </button>
            <button
              onClick={() => setDigits(digits.slice(0, -1))}
              className="h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-400 active:scale-95 transition-all"
              aria-label="한 글자 지움"
            >
              <Delete size={28} />
            </button>
          </div>
        )}

        {busy && step === 'input' && (
          <div className="flex justify-center text-gray-400">
            <Loader size={24} className="animate-spin" />
          </div>
        )}

        {/* 본인 확인 + 등/하원 선택 */}
        {step === 'select' && (
          <div className="space-y-3">
            <p className="text-center text-sm font-semibold text-gray-600">
              본인 이름을 확인하고 눌러 주세요
            </p>
            {candidates.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.grade}{s.className ? ` · ${s.className}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCheckIn(s)}
                    disabled={busy || s.checkedIn}
                    className="flex-1 h-16 rounded-xl bg-indigo-500 text-white text-lg font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <LogIn size={22} /> 등원
                  </button>
                  <button
                    onClick={() => handleCheckOut(s)}
                    disabled={busy || !s.checkedIn}
                    className="flex-1 h-16 rounded-xl bg-emerald-500 text-white text-lg font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <LogOut size={22} /> 하원
                  </button>
                </div>
                {s.checkedIn && !s.checkedOut && (
                  <p className="text-center text-[11px] text-gray-400">등원 완료 상태예요</p>
                )}
                {s.checkedOut && (
                  <p className="text-center text-[11px] text-gray-400">하원 완료 상태예요 (재입력 시 갱신)</p>
                )}
              </div>
            ))}
            <button
              onClick={reset}
              className="w-full py-4 text-gray-400 font-semibold text-sm"
            >
              처음으로
            </button>
          </div>
        )}

        {/* 결과 — 3초 후 자동 초기화 */}
        {step === 'result' && message && (
          <div className={`rounded-2xl p-6 text-center space-y-2 ${TONE_STYLES[message.tone]}`}>
            {message.tone === 'error'
              ? <AlertCircle size={40} className="mx-auto" />
              : <CheckCircle2 size={40} className="mx-auto" />}
            <p className="text-lg font-bold">{message.text}</p>
            <button onClick={reset} className="text-xs opacity-60 underline">바로 처음으로</button>
          </div>
        )}
      </div>
    </div>
  )
}
