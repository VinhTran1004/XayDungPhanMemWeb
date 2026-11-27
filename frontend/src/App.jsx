import React, { useState, useEffect, useRef } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import ConceptModal from './components/ConceptModal';

import HomeView from './views/HomeView';
import ConceptsView from './views/ConceptsView';
import PricingView from './views/PricingView';
import RoomsView from './views/RoomsView';
import BookingView from './views/BookingView';
import MyBookingsView from './views/MyBookingsView';
import AlbumsView from './views/AlbumsView';
import AdminView from './views/AdminView';

import './App.css';

function MainApp() {
  const [activeView, setActiveView] = useState('home');
  const [bookingConcept, setBookingConcept] = useState(null);
  const [conceptDetail, setConceptDetail] = useState(null);
  const [selectedAlbumBookingId, setSelectedAlbumBookingId] = useState(null);
  const { user, isAdmin } = useAuth();
  const prevUserRef = useRef(null);

  // Khi vừa đăng nhập thành công với tài khoản Quản trị viên (Admin), tự động vào thẳng giao diện Quản Trị
  useEffect(() => {
    if (!prevUserRef.current && user && user.vai_tro === 'quan_tri_vien') {
      setActiveView('admin');
    }
    prevUserRef.current = user;
  }, [user]);

  const handleSelectConceptForBooking = (concept) => {
    setBookingConcept(concept);
    setActiveView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenConceptDetail = (concept) => {
    setConceptDetail(concept);
  };

  const handleOpenAlbum = (bookingId) => {
    setSelectedAlbumBookingId(bookingId);
    setActiveView('albums');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // NẾU LÀ ADMIN VÀ ĐANG Ở VIEW 'admin':
  // Hiển thị giao diện Quản Trị Toàn Màn Hình (Full Page Admin Dashboard)
  // với Sidebar xanh quả bơ và Header riêng biệt theo đúng ảnh mẫu
  if (activeView === 'admin' && isAdmin) {
    return (
      <div className="admin-app-root">
        <AdminView setActiveView={setActiveView} />
        <AuthModal onAdminLogin={() => setActiveView('admin')} />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenBookingWithConcept={handleSelectConceptForBooking}
      />

      <main className="main-content">
        {activeView === 'home' && (
          <HomeView
            setActiveView={setActiveView}
            onSelectConcept={handleSelectConceptForBooking}
            onOpenConceptDetail={handleOpenConceptDetail}
          />
        )}

        {activeView === 'concepts' && (
          <ConceptsView
            onSelectConcept={handleSelectConceptForBooking}
            onOpenConceptDetail={handleOpenConceptDetail}
          />
        )}

        {activeView === 'pricing' && (
          <PricingView setActiveView={setActiveView} />
        )}

        {activeView === 'rooms' && (
          <RoomsView setActiveView={setActiveView} />
        )}

        {activeView === 'booking' && (
          <BookingView
            initialConcept={bookingConcept}
            setActiveView={setActiveView}
          />
        )}

        {activeView === 'my-bookings' && (
          <MyBookingsView
            setActiveView={setActiveView}
            onOpenAlbum={handleOpenAlbum}
          />
        )}

        {activeView === 'albums' && (
          <AlbumsView initialBookingId={selectedAlbumBookingId} />
        )}

        {activeView === 'admin' && (
          <AdminView setActiveView={setActiveView} />
        )}
      </main>

      <Footer setActiveView={setActiveView} />

      {/* Global Modals */}
      <AuthModal onAdminLogin={() => setActiveView('admin')} />
      <ConceptModal
        concept={conceptDetail}
        onClose={() => setConceptDetail(null)}
        onBookNow={handleSelectConceptForBooking}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}
