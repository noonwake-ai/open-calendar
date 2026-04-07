import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router/router'
import './index.scss'
import './common/utils/array-extensions'

const container = document.getElementById('root')
if (container) {
    createRoot(container).render(<RouterProvider router={router} />)
}
