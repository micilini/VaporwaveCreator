import { useNavigate } from 'react-router-dom'

function Error404() {
  const navigate = useNavigate()
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, background: 'var(--color-bg)' }}>
      <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 32, background: 'var(--gradient-vapor)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>４０４</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>This page does not exist in Vaporwave Creator.</p>
      <button onClick={() => navigate('/')} style={{ padding: '12px 28px', borderRadius: 8, background: 'transparent', border: '1px solid var(--color-secondary)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13, letterSpacing: 2 }}>← GO BACK</button>
    </div>
  )
}

export default Error404