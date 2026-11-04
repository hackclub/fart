import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App'
import { startTheme } from './theme/store'

startTheme()

createRoot(document.getElementById('root')!).render(<App />)
