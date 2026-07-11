import AppRoutes from "./routes/AppRoutes";
import "./firebase/firebaseConfig";
import { Toaster } from "react-hot-toast";
import NotificationObserver from "./components/common/NotificationObserver";

function App() {
  return (
    <>
      <NotificationObserver />
      <Toaster position="top-right" toastOptions={{
        className: 'md:top-right sm:top-center',
        duration: 4000,
      }} />
      <AppRoutes />
    </>
  );
}

export default App;