import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import CounselingTabContent from '../../components/counseling/CounselingTabContent.jsx'

export default function CounselingTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  // 관리자: 전체 상담 기록 열람·작성, 전체 학생 대상, 작성자 표시.
  const records = data.counselingRecords.slice().reverse()

  return (
    <CounselingTabContent
      students={data.students}
      records={records}
      showAuthor
      authorId={currentUser?.id}
    />
  )
}
