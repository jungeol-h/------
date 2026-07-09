import { useData } from '../../context/DataContext.jsx'
import CounselingTabContent from '../../components/counseling/CounselingTabContent.jsx'

export default function ViewerCounselingTab() {
  const { data } = useData()

  // 열람자: 전체 상담 기록·전체 학생 열람 전용. 작성/수정/삭제 불가(readOnly).
  // 최신 상담이 위로(date 내림차순, 같은 날은 id 내림차순으로 안정 정렬).
  const records = data.counselingRecords
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1))

  return (
    <CounselingTabContent
      students={data.students}
      records={records}
      showAuthor
      readOnly
    />
  )
}
