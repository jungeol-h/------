import { useMemo, useState } from 'react'
import { CheckCheck, Pencil, Trash2, FileSpreadsheet } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import ModalShell from '../common/ModalShell.jsx'
import {
  FINANCE_CATEGORIES, FINANCE_CATEGORY_LABELS,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS,
} from '../../data/workRecordTypes.js'
import { AttachmentField, AttachmentChips } from '../counseling/AttachmentField.jsx'
import {
  validateReceipt, uploadReceiptFiles, receiptFileUrl, removeReceiptFiles,
} from '../../lib/financeFiles.js'
import { buildFinanceSheet } from '../../utils/financeExcel.js'
import { reportError } from '../../lib/sentry.js'
import { todayStr as today } from '../../utils/dateUtils.js'


const EMPTY_FORM = () => ({
  date: today(),
  category: FINANCE_CATEGORIES[0],
  itemName: '',
  unitPrice: '',
  quantity: '',
  amount: '',
  vendor: '',
  paymentMethod: PAYMENT_METHODS[0],
})

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300'

const won = (n) => `${(n ?? 0).toLocaleString('ko-KR')}원`
const toInt = (v) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

// 재정 폼 필드 그룹 — 작성 섹션과 수정 모달이 공유.
// 단가·갯수 입력 시 금액을 자동 계산해 채우되, 금액 칸은 직접 수정도 허용한다.
function FinanceFields({ value, onChange }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })
  const setWithAmount = (key) => (e) => {
    const next = { ...value, [key]: e.target.value }
    next.amount = String(toInt(next.unitPrice) * toInt(next.quantity) || '')
    onChange(next)
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">날짜</label>
          <input type="date" value={value.date} onChange={set('date')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">구입품목</label>
          <select value={value.category} onChange={set('category')} className={`${fieldClass} w-full`}>
            {FINANCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{FINANCE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">물품명</label>
        <input type="text" value={value.itemName} onChange={set('itemName')} className={`${fieldClass} w-full`} placeholder="예: A4 용지" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">단가(원)</label>
          <input type="number" min="0" value={value.unitPrice} onChange={setWithAmount('unitPrice')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">갯수</label>
          <input type="number" min="0" value={value.quantity} onChange={setWithAmount('quantity')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">금액(원)</label>
          <input type="number" min="0" value={value.amount} onChange={set('amount')} className={`${fieldClass} w-full`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">구입처</label>
          <input type="text" value={value.vendor} onChange={set('vendor')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">결제수단</label>
          <select value={value.paymentMethod} onChange={set('paymentMethod')} className={`${fieldClass} w-full`}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}

// 재정 메뉴 — 관리자 전용 작성, 표 형태 누적 + 엑셀 다운로드(viewer 포함).
export default function FinanceSection({ readOnly = false }) {
  const { data, addFinanceRecord, updateFinanceRecord, deleteFinanceRecord } = useData()
  const { currentUser } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [attachFiles, setAttachFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editAttachments, setEditAttachments] = useState([])
  const [editAttachFiles, setEditAttachFiles] = useState([])

  const records = data.financeRecords
  const total = useMemo(() => records.reduce((sum, r) => sum + (r.amount ?? 0), 0), [records])

  const canSave = !saving && form.date && form.itemName.trim()

  const toPayload = (f) => ({
    date: f.date,
    category: f.category,
    itemName: f.itemName.trim(),
    unitPrice: toInt(f.unitPrice),
    quantity: toInt(f.quantity),
    amount: toInt(f.amount),
    vendor: f.vendor.trim(),
    paymentMethod: f.paymentMethod,
  })

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const attachments = attachFiles.length > 0 ? await uploadReceiptFiles(attachFiles, currentUser?.id) : []
      await addFinanceRecord({ authorId: currentUser?.id, ...toPayload(form), attachments })
      setForm(EMPTY_FORM())
      setAttachFiles([])
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (r) => {
    if (!window.confirm('이 재정 기록을 삭제할까요?')) return
    try {
      await deleteFinanceRecord(r.id)
      removeReceiptFiles(r.attachments?.map((a) => a.path)) // 실파일 정리 (best-effort)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const openEdit = (r) => {
    setEditing(r)
    setEditForm({
      date: r.date,
      category: r.category,
      itemName: r.itemName,
      unitPrice: String(r.unitPrice ?? ''),
      quantity: String(r.quantity ?? ''),
      amount: String(r.amount ?? ''),
      vendor: r.vendor,
      paymentMethod: r.paymentMethod,
    })
    setEditAttachments(r.attachments ?? [])
    setEditAttachFiles([])
  }

  const handleEditSave = async () => {
    if (!editForm?.date || !editForm.itemName.trim()) return
    setSaving(true)
    try {
      const uploaded = editAttachFiles.length > 0 ? await uploadReceiptFiles(editAttachFiles, currentUser?.id) : []
      const attachments = [...editAttachments, ...uploaded]
      await updateFinanceRecord(editing.id, { ...toPayload(editForm), attachments })
      // 수정에서 제거된 첨부의 실파일 정리 (best-effort)
      const keptPaths = new Set(editAttachments.map((a) => a.path))
      removeReceiptFiles((editing.attachments ?? []).filter((a) => !keptPaths.has(a.path)).map((a) => a.path))
      setEditing(null)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  // 엑셀 다운로드 — AttendanceExcelModal의 exceljs 동적 import 패턴.
  const handleExport = async () => {
    if (exporting || records.length === 0) return
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const { header, rows, totalRow } = buildFinanceSheet(records, { educators: data.educators })
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('재정')
      const headerRow = sheet.addRow(header)
      headerRow.font = { bold: true }
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
        cell.alignment = { horizontal: 'center' }
      })
      rows.forEach((r) => sheet.addRow(r))
      const sumRow = sheet.addRow(totalRow)
      sumRow.font = { bold: true }
      sheet.columns.forEach((col, i) => {
        col.width = [12, 10, 20, 10, 7, 12, 16, 10, 10][i] ?? 12
        if ([3, 5].includes(i)) col.numFmt = '#,##0'
      })
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `재정_${today()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      reportError(e, { where: 'FinanceSection.export' })
      alert('엑셀 생성에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-gray-900">새 재정 기록</h2>
          <FinanceFields value={form} onChange={setForm} />
          <AttachmentField
            pending={attachFiles}
            onChangePending={setAttachFiles}
            accept="image/*,application/pdf,.pdf"
            validate={validateReceipt}
            kindLabel="영수증·사진"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="py-2.5 px-6 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCheck size={16} />
              저장
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">재정 누적 내역</h2>
          <button
            onClick={handleExport}
            disabled={exporting || records.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition"
          >
            <FileSpreadsheet size={14} />
            {exporting ? '생성 중…' : '엑셀 다운로드'}
          </button>
        </div>

        {records.length === 0 ? (
          <div className="text-center text-gray-400 py-12">재정 기록이 없어요 💳</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100 bg-gray-50/60">
                  <th className="px-3 py-2.5 text-left font-semibold">날짜</th>
                  <th className="px-3 py-2.5 text-left font-semibold">구입품목</th>
                  <th className="px-3 py-2.5 text-left font-semibold">물품명</th>
                  <th className="px-3 py-2.5 text-right font-semibold">단가</th>
                  <th className="px-3 py-2.5 text-right font-semibold">갯수</th>
                  <th className="px-3 py-2.5 text-right font-semibold">금액</th>
                  <th className="px-3 py-2.5 text-left font-semibold">구입처</th>
                  <th className="px-3 py-2.5 text-left font-semibold">결제수단</th>
                  <th className="px-3 py-2.5 text-left font-semibold">영수증</th>
                  {!readOnly && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                        {FINANCE_CATEGORY_LABELS[r.category] ?? r.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium">{r.itemName}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">{won(r.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{r.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-gray-800 font-semibold whitespace-nowrap">{won(r.amount)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{r.vendor}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}</td>
                    <td className="px-3 py-2.5">
                      <AttachmentChips attachments={r.attachments} fileUrl={receiptFileUrl} />
                    </td>
                    {!readOnly && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600 p-0.5" aria-label="재정 수정">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(r)} className="text-gray-400 hover:text-red-600 p-0.5 ml-1" aria-label="재정 삭제">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/60 font-bold text-gray-800">
                  <td className="px-3 py-2.5" colSpan={5}>합계</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">{won(total)}</td>
                  <td className="px-3 py-2.5" colSpan={readOnly ? 3 : 4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {editing && editForm && (
        <ModalShell title="재정 기록 수정" onClose={() => setEditing(null)}>
            <FinanceFields value={editForm} onChange={setEditForm} />
            <AttachmentField
              existing={editAttachments}
              onRemoveExisting={(path) => setEditAttachments((prev) => prev.filter((a) => a.path !== path))}
              pending={editAttachFiles}
              onChangePending={setEditAttachFiles}
              accept="image/*,application/pdf,.pdf"
              validate={validateReceipt}
              kindLabel="영수증·사진"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium">
                취소
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving || !editForm.date || !editForm.itemName.trim()}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCheck size={16} />
                저장
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  )
}
