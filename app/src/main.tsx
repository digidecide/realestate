import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import { AuthProvider } from './auth/AuthProvider';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import PropertyDetail from './pages/PropertyDetail';
import { Account, SignIn, SignUp } from './pages/Auth';
import { PropertyForm, SellerDashboard } from './pages/Seller';
import { BuyerDashboard } from './pages/Buyer';
import { AdminDashboard, ReviewPage, ReviewsDashboard } from './pages/Admin';
import { Empty } from './components/ui';

// Hash routes (/#/search) work on GitHub Pages without server rewrites.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/search', element: <Search /> },
      { path: '/property/:id', element: <PropertyDetail /> },
      { path: '/signin', element: <SignIn /> },
      { path: '/signup', element: <SignUp /> },
      { path: '/account', element: <Account /> },
      { path: '/seller', element: <SellerDashboard /> },
      { path: '/seller/property/:id', element: <PropertyForm /> },
      { path: '/buyer', element: <BuyerDashboard /> },
      { path: '/admin', element: <AdminDashboard /> },
      { path: '/reviews', element: <ReviewsDashboard /> },
      { path: '/review/:id', element: <ReviewPage /> },
      { path: '*', element: <div className="wrap page"><Empty title="This page does not exist"><a href="#/">Go to the home page</a></Empty></div> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
