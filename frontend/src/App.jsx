import { Navigate, Route, Routes } from 'react-router-dom'
import StudentLayout from './components/student/StudentLayout'
import AdminLayout from './pages/Admin/AdminLayout'
import Dashboard from './pages/Admin/Dashboard'
import ExamDetail from './pages/Admin/ExamDetail'
import NewExam from './pages/Admin/NewExam'
import SessionReview from './pages/Admin/SessionReview'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'
import CodeEntry from './pages/Student/CodeEntry'
import Details from './pages/Student/Details'
import ExamRoom from './pages/Student/ExamRoom'
import Launcher from './pages/Student/Launcher'
import Result from './pages/Student/Result'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* Student flow (flowchart: code -> launcher -> details -> exam -> confirmation) */}
      <Route path="/student" element={<StudentLayout />}>
        <Route index element={<CodeEntry />} />
        <Route path=":code/launch" element={<Launcher />} />
        <Route path=":code/details" element={<Details />} />
        <Route path="session/:sessionId" element={<ExamRoom />} />
        <Route path="session/:sessionId/result" element={<Result />} />
      </Route>

      <Route path="/exam" element={<Navigate to="/student" replace />} />

      {/* Admin area: owned by the admin dashboard developer */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="exams/new" element={<NewExam />} />
        <Route path="exams/:examId" element={<ExamDetail />} />
        <Route path="sessions/:sessionId" element={<SessionReview />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}