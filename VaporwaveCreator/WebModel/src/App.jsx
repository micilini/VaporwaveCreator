import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import AudioEditor from './pages/AudioEditor'
import ArcadeGame from './pages/ArcadeGame'
import Error404 from './pages/Error404'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/editor" element={<AudioEditor />} />
       <Route path="/arcade" element={<ArcadeGame />} />
      <Route path="*" element={<Error404 />} />
    </Routes>
  )
}

export default App