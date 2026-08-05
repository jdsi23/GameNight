import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import Home from './components/Home'
import RoomShell from './components/RoomShell'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:code" element={<RoomShell />} />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  )
}
