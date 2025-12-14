import { AppRouter } from '@/routes';
import { useAuthInit } from '@/hooks';
import '@/styles/index.css';

function App() {
  // Initialize auth state from localStorage on app start
  useAuthInit();

  return <AppRouter />;
}

export default App;
