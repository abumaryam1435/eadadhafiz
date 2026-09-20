
import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';

interface ChangePasswordModalProps {
  onClose: () => void;
  supervisorPassword: string;
  setSupervisorPassword: (password: string) => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, supervisorPassword, setSupervisorPassword }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const oldPasswordInputRef = useRef<HTMLInputElement>(null);
  const newPasswordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus on desktop is handled here (if not on mobile)
    if (oldPasswordInputRef.current && window.innerWidth >= 768) {
      oldPasswordInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Clear messages when inputs change
    if (message) {
      setMessage(null);
    }
  }, [oldPassword, newPassword, confirmPassword]);

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (oldPassword !== supervisorPassword) {
      setMessage({ type: 'error', text: 'الرقم السري القديم غير صحيح.' });
      return;
    }
    if (newPassword.length < 4) {
      setMessage({ type: 'error', text: 'الرقم السري الجديد يجب أن يكون 4 أحرف على الأقل.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'الرقم السري الجديد وتأكيده غير متطابقين.' });
      return;
    }

    setSupervisorPassword(newPassword);
    setMessage({ type: 'success', text: 'تم تغيير الرقم السري بنجاح.' });
    
    // Clear fields and close modal after a delay
    setTimeout(() => {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
    }, 1500);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (window.innerWidth < 768) { // Only on mobile screens
        setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'start' }); // Scroll to start (top)
        }, 250); // Increased timeout
    }
  };

  return (
    <Modal title="تغيير الرقم السري للمشرف" onClose={onClose} hideDefaultCloseButton={true}>
      <form onSubmit={handleSubmitPassword} className="space-y-4">
        {message && (
          <div className={`p-3 rounded-md text-center mb-4 text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
            <p>{message.text}</p>
          </div>
        )}
        <div>
          <label htmlFor="old-password-modal" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">الرقم السري القديم</label>
          <input
            id="old-password-modal"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="input-style"
            required
            ref={oldPasswordInputRef}
            aria-label="الرقم السري القديم"
            onFocus={handleInputFocus}
          />
        </div>
        <div>
          <label htmlFor="new-password-modal" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">الرقم السري الجديد</label>
          <input
            id="new-password-modal"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input-style"
            minLength={4}
            required
            ref={newPasswordInputRef}
            aria-label="الرقم السري الجديد"
            onFocus={handleInputFocus}
          />
        </div>
        <div>
          <label htmlFor="confirm-password-modal" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">تأكيد الرقم السري الجديد</label>
          <input
            id="confirm-password-modal"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-style"
            minLength={4}
            required
            ref={confirmPasswordInputRef}
            aria-label="تأكيد الرقم السري الجديد"
            onFocus={handleInputFocus}
          />
        </div>
        <div className="flex justify-end gap-4 mt-6 pt-4 border-t dark:border-gray-700">
            <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
                إلغاء
            </button>
            <button type="submit" className="px-6 py-2 text-lg font-semibold text-white bg-green-700 rounded-lg hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 transition-colors">
                حفظ الرقم السري
            </button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
