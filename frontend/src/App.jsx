import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Admin/Dashboard'
import NotFound from './pages/NotFound'
import StudentLayout from './components/student/StudentLayout'
import CodeEntry from './pages/Student/CodeEntry'
import Launcher from './pages/Student/Launcher'
import Details from './pages/Student/Details'
import ExamRoom from './pages/Student/ExamRoom'
import Result from './pages/Student/Result'

export default function App() {
  return (
    <Routes>
      {/* Student flow (flowchart: code -> launcher -> details -> exam -> confirmation) */}
      <Route path="/student" element={<StudentLayout />}>
        <Route index element={<CodeEntry />} />
        <Route path=":code/launch" element={<Launcher />} />
        <Route path=":code/details" element={<Details />} />
        <Route path="session/:sessionId" element={<ExamRoom />} />
        <Route path="session/:sessionId/result" element={<Result />} />
      </Route>
      <Route path="/exam" element={<Navigate to="/student" replace />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}