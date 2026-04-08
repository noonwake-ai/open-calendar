import { createBrowserRouter, Navigate } from 'react-router-dom'
import { paths } from './urls'
import React from 'react'
import Pairing from '../pages/pairing'
import NotFound from '../pages/not-found'
import CalendarHome from '../home'
import Settings from '../home/settings'
import FortuneTypeDetail from '../home/fortune-type-detail'
import TodoCalendar from '../home/todo-calendar'
import ShakeHexagram from '../home/shake-hexagram'
import SpecialDayDetail from '../home/special-day-detail'
import ProjectionScreen from '../pages/projection'
import DifyChatDemo from '../pages/dify-chat-demo'
import DoubaoRealtimeDemo from '../pages/doubao-realtime-demo'

export const router = createBrowserRouter([{
    path: paths.index,
    element: <Navigate to={paths.login} />,
}, {
    path: paths.pairing,
    element: <Navigate to={paths.login} replace />,
}, {
    path: paths.login,
    element: <Pairing />,
}, {
    path: paths.projection,
    element: <ProjectionScreen />,
}, {
    path: paths.difyChatDemo,
    element: <DifyChatDemo />,
}, {
    path: paths.doubaoRealtimeDemo,
    element: <DoubaoRealtimeDemo />,
}, {
    path: paths.home.index,
    element: <CalendarHome />,
}, {
    path: paths.home.fortuneType,
    element: <FortuneTypeDetail />,
}, {
    path: paths.home.specialDay,
    element: <SpecialDayDetail />,
}, {
    path: paths.home.todo,
    element: <TodoCalendar />,
}, {
    path: paths.home.shake,
    element: <ShakeHexagram />,
}, {
    path: paths.home.settings,
    element: <Settings />,
}, {
    path: '/*',
    element: <NotFound />,
}])
