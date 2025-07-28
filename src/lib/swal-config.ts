import Swal from 'sweetalert2';

// Custom SweetAlert2 theme configuration to match the app's dark theme
export const swalConfig = {
  customClass: {
    popup: 'bg-gray-800 border border-gray-700 rounded-xl shadow-2xl',
    title: 'text-white text-xl font-bold',
    content: 'text-gray-300',
    confirmButton: 'bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-lg mr-2 border-0',
    cancelButton: 'bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded-lg border-0',
    loader: 'border-purple-500',
    validationMessage: 'bg-red-900 border border-red-500 text-red-200 rounded-lg',
  },
  background: '#1f2937', // gray-800
  color: '#d1d5db', // gray-300
  showClass: {
    popup: 'animate__animated animate__fadeInDown animate__faster'
  },
  hideClass: {
    popup: 'animate__animated animate__fadeOutUp animate__faster'
  }
};

// Helper function to show loading alert
export const showLoadingAlert = (title: string, text: string) => {
  return Swal.fire({
    ...swalConfig,
    title,
    text,
    icon: 'info',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

// Helper function to show success alert
export const showSuccessAlert = (title: string, text: string, timer = 3000) => {
  return Swal.fire({
    ...swalConfig,
    icon: 'success',
    title,
    text,
    timer,
    showConfirmButton: false,
  });
};

// Helper function to show error alert
export const showErrorAlert = (title: string, text: string) => {
  return Swal.fire({
    ...swalConfig,
    icon: 'error',
    title,
    text,
  });
};

// Helper function to show info alert
export const showInfoAlert = (title: string, text: string) => {
  return Swal.fire({
    ...swalConfig,
    icon: 'info',
    title,
    text,
  });
};

// Helper function to update existing alert
export const updateAlert = (options: any) => {
  return Swal.update({
    ...swalConfig,
    ...options,
  });
};
