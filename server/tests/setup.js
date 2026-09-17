// Must run before any module reads process.env — it routes the suite at the
// throwaway test database and silences rate limiting.
process.env.NODE_ENV = 'test';
