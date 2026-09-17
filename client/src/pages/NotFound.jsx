import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl" aria-hidden="true">
        🧭
      </p>
      <h1 className="mt-4 text-2xl font-extrabold">Page not found</h1>
      <p className="mt-1 text-slate-600">That page does not exist.</p>
      <Link to="/" className="mt-6 inline-block">
        <Button>Back to lessons</Button>
      </Link>
    </div>
  );
}
