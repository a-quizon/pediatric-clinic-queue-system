import AppRoutes from "./routes/AppRoutes";
import "./firebase/firebaseConfig";
import { Toaster } from "react-hot-toast";
import NotificationObserver from "./components/common/NotificationObserver";
import PushPermissionGate from "./components/parent/PushPermissionGate";

function App() {
  return (
    <>
      <NotificationObserver />
      <PushPermissionGate />
      <Toaster position="top-right" toastOptions={{
        className: 'md:top-right sm:top-center',
        duration: 4000,
      }} />
      <AppRoutes />
    </>
  );
}

export default App;