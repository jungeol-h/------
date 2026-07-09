import { useEffect, useState, useCallback } from 'react'
import { Loader, ChevronLeft, Plus, UserPlus, AlertCircle } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { fetchPrograms, fetchProgramDetail } from './externalData.js'
import ExternalStudentList from './ExternalStudentList.jsx'
import ExternalStudentDetail from './ExternalStudentDetail.jsx'
import { ProgramFormModal, StudentImportModal } from './ExternalAdminModals.jsx'

// 외생 상담 프로그램 진입점.
// 플로우: 프로그램 선택 → 학교별 학생 목록 → 학생 선택 → 상담 기록.
// 데이터는 DataContext와 격리 — 이 탭 진입 시 lazy fetch + 로컬 state.
export default function ExternalCounselingTab() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [programs, setPrograms] = useState([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [programsError, setProgramsError] = useState(false)

  const [selectedProgram, setSelectedProgram] = useState(null)
  const [students, setStudents] = useState([])
  const [records, setRecords] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)

  const [selectedStudent, setSelectedStudent] = useState(null)

  const [showProgramForm, setShowProgramForm] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true)
    setProgramsError(false)
    try {
      setPrograms(await fetchPrograms())
    } catch {
      setProgramsError(true)
    } finally {
      setProgramsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPrograms()
  }, [loadPrograms])

  const openProgram = useCallback(async (program) => {
    setSelectedProgram(program)
    setSelectedStudent(null)
    setDetailLoading(true)
    setDetailError(false)
    try {
      const { students: s, records: r } = await fetchProgramDetail(program.id)
      setStudents(s)
      setRecords(r)
    } catch {
      setDetailError(true)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // ── 로컬 state 동기화 (쓰기 후) ──
  const handleRecordAdded = (rec) => setRecords((prev) => [rec, ...prev])
  const handleRecordUpdated = (rec) =>
    setRecords((prev) => prev.map((r) => (r.id === rec.id ? rec : r)))
  const handleRecordDeleted = (id) =>
    setRecords((prev) => prev.filter((r) => r.id !== id))

  // ── 프로그램 목록 화면 ──
  if (!selectedProgram) {
    if (programsLoading) {
      return (
        <div className="flex flex-col items-center gap-3 text-gray-400 py-16">
          <Loader size={28} className="animate-spin" />
          <p className="text-sm">프로그램 불러오는 중...</p>
        </div>
      )
    }
    if (programsError) {
      return (
        <div className="flex flex-col items-center gap-3 text-gray-400 py-16">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">프로그램을 불러오지 못했습니다.</p>
          <button
            onClick={loadPrograms}
            className="text-sm text-blue-600 font-semibold"
          >
            다시 시도
          </button>
        </div>
      )
    }
    return (
      <div className="space-y-3">
        {isAdmin && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowProgramForm(true)}
              className="flex items-center gap-1 bg-emerald-500 text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all"
            >
              <Plus size={16} /> 프로그램 추가
            </button>
          </div>
        )}
        {programs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-gray-400 py-16">
            <p className="text-sm">등록된 외부 상담 프로그램이 없습니다.</p>
          </div>
        ) : (
          programs.map((p) => (
            <button
              key={p.id}
              onClick={() => openProgram(p)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm text-left hover:bg-gray-50 flex items-center justify-between"
            >
              <div>
                <p className="font-bold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.year ? `${p.year}년` : ''}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === 'active'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.status === 'active' ? '진행중' : '종료'}
              </span>
            </button>
          ))
        )}

        {showProgramForm && (
          <ProgramFormModal
            onClose={() => setShowProgramForm(false)}
            onSaved={(created) => setPrograms((prev) => [created, ...prev])}
          />
        )}
      </div>
    )
  }

  // ── 학생 상세 화면 ──
  if (selectedStudent) {
    const studentRecords = records.filter((r) => r.programStudentId === selectedStudent.id)
    return (
      <ExternalStudentDetail
        student={selectedStudent}
        records={studentRecords}
        onBack={() => setSelectedStudent(null)}
        onRecordAdded={handleRecordAdded}
        onRecordUpdated={handleRecordUpdated}
        onRecordDeleted={handleRecordDeleted}
      />
    )
  }

  // ── 프로그램 상세(학생 목록) 화면 ──
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedProgram(null)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft size={16} /> 프로그램 목록
        </button>
        {isAdmin && (
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1 bg-blue-500 text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-blue-600 active:scale-95 transition-all"
          >
            <UserPlus size={16} /> 학생 등록
          </button>
        )}
      </div>

      <p className="font-bold text-gray-900">{selectedProgram.name}</p>

      {detailLoading ? (
        <div className="flex flex-col items-center gap-3 text-gray-400 py-16">
          <Loader size={28} className="animate-spin" />
          <p className="text-sm">학생 불러오는 중...</p>
        </div>
      ) : detailError ? (
        <div className="flex flex-col items-center gap-3 text-gray-400 py-16">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">학생을 불러오지 못했습니다.</p>
          <button
            onClick={() => openProgram(selectedProgram)}
            className="text-sm text-blue-600 font-semibold"
          >
            다시 시도
          </button>
        </div>
      ) : students.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">
          등록된 학생이 없습니다.
          {isAdmin && ' 상단 "학생 등록"으로 추가하세요.'}
        </p>
      ) : (
        <ExternalStudentList
          students={students}
          records={records}
          onSelect={setSelectedStudent}
        />
      )}

      {showImport && (
        <StudentImportModal
          programId={selectedProgram.id}
          onClose={() => setShowImport(false)}
          onSaved={(created) => setStudents((prev) => [...prev, ...created])}
        />
      )}
    </div>
  )
}
