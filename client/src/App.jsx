import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SpeechProvider } from './context/SpeechContext';
import { Layout } from './components/Layout';
import { ProtectedRoute, PublicOnlyRoute } from './routes/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import UnitMap from './pages/UnitMap';
import Lesson from './pages/Lesson';
import Review from './pages/Review';
import Profile from './pages/Profile';
import Words from './pages/Words';
import Courses from './pages/Courses';
import Alphabet from './pages/Alphabet';
import AlphabetPractice from './pages/AlphabetPractice';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <SpeechProvider>
        <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <Signup />
            </PublicOnlyRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<UnitMap />} />
          <Route path="lesson/:slug" element={<Lesson />} />
          <Route path="review" element={<Review />} />
          <Route path="words" element={<Words />} />
          <Route path="courses" element={<Courses />} />
          <Route path="alphabet" element={<Alphabet />} />
          <Route path="alphabet/practice" element={<AlphabetPractice />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        </Routes>
      </SpeechProvider>
    </AuthProvider>
  );
}
