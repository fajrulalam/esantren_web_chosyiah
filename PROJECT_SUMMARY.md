# Asrama Chosyi'ah Web Application - Project Summary

## 📋 Overview

This is a comprehensive web-based management system for **Asrama Mahasiswi Chosyi'ah** (Chosyi'ah Women's Dormitory) at Universitas Pesantren Tinggi Darul Ulum (Unipdu), Jombang, East Java. The application serves as an integrated platform for managing dormitory operations, including student registration, payment tracking, attendance monitoring, and leave/sick permissions.

**Project Name:** `sistem_pembayaran_asrama` (Dormitory Payment System)  
**Version:** 0.1.0  
**Framework:** Next.js 15.2.1 (React 18.3.1)  
**Backend:** Firebase (Firestore Database, Authentication, Storage)  
**Dormitory Code:** `ASR11` (Asrama XI - Muzamzamah Qhosyi'ah Putri)

---

## 🎯 Purpose

The application aims to:

1. **Streamline Registration**: Enable prospective students to register online for dormitory accommodation
2. **Manage Payments**: Track and verify dormitory fees and monthly bills (vouchers)
3. **Monitor Attendance**: Record santri (student) attendance for various sessions (morning, afternoon, evening)
4. **Handle Permissions**: Process sick leave and home visit requests from santri
5. **Centralize Data**: Provide administrators with comprehensive student data management
6. **Enhance Transparency**: Allow parents (wali santri) to view payment history and submit payments

---

## 👥 User Roles

The system supports four distinct user roles, each with specific permissions:

### 1. **Wali Santri** (Parents/Guardians)
- View payment history for their child
- Upload payment proof
- Check payment status
- View voucher details
- Submit leave/sick permission requests
- Track permission request status

### 2. **Pengurus** (Dormitory Committee/Management)
- Verify payment submissions
- Manage payment invoices
- Create and manage vouchers
- Access student data
- Record attendance
- Review and approve permission requests (initial stage)

### 3. **Pengasuh** (Dormitory Supervisor/Ustadzah)
- All Pengurus permissions
- Final approval for permission requests
- Advanced student monitoring
- Generate reports

### 4. **Super Admin**
- All system permissions
- User management (create new pengurus/pengasuh accounts)
- System configuration
- Full data access and control

---

## 🔐 Authentication System

The application uses a **multi-authentication approach**:

### Firebase Authentication
- **Email/Password**: For pengurus, pengasuh, and super admin
- **Google OAuth**: Alternative login for staff members
- Role-based authorization checked against `PengurusCollection` in Firestore

### Special Wali Santri Authentication
- **No Firebase Auth Required**: Parents log in using santri name + phone number
- **Verification**: Credentials matched against `SantriCollection`
- **Session Persistence**: Uses localStorage for maintaining login state
- **Name Formatting**: Automatic capitalization handling for Indonesian names

**Authentication Flow:**
1. User visits `/login` page
2. Selects role (Staff/Wali Santri)
3. Provides credentials
4. System verifies against Firestore
5. Redirects to appropriate dashboard based on role

---

## 🗄️ Database Structure

The application uses **Firebase Firestore** with the following main collections:

### Collections

1. **SantriCollection**
   - Student master data
   - Fields: nama, kamar, kelas, tahunMasuk, nomorWalisantri, statusTanggungan, statusAktif, tanggalLahir, kodeAsrama, nomorTelpon, etc.

2. **PengurusCollection**
   - Staff user accounts
   - Fields: email, name, role, phoneNumber, uid, honoraryPronoun, kodeAsrama, namaPanggilan, tanggalLahir

3. **PaymentInvoice**
   - Payment bills/invoices
   - Fields: paymentName, nominal, selectedSantriIds, timestamp, numberOfPaid, numberOfWaitingVerification

4. **PaymentStatus**
   - Individual payment tracking per santri
   - Fields: santriId, invoiceId, status, paid, total, history (nested)

5. **VoucherGroups**
   - Monthly recurring bills
   - Fields: groupName, amount, recurrence, selectedSantriIds

6. **AttendanceSession**
   - Attendance records
   - Fields: kodeAsrama, date, sessionType, teacherId, teacherName, attendanceRecords

7. **IzinSakitPulangCollection**
   - Leave/sick permission requests
   - Fields: santriId, santriNama, type, startDate, endDate, reason, status, documents, approvals

---

## 📄 Pages & Features

### Public Pages

#### **Home Page** (`/` - `page.tsx`)
- **Purpose**: Landing page for dormitory promotion and information
- **Features**:
  - Hero section with dormitory description
  - Facility showcase (rooms, canteen, bathrooms, environment)
  - Location map integration (Google Maps)
  - Registration call-to-action
  - Contact information
  - Responsive design with dark mode support
- **Routing**: Automatically redirects authenticated users to their respective dashboard

#### **Registration Page** (`/registration/page.tsx`)
- **Purpose**: Online registration for new santri
- **Features**:
  - Multi-step form (personal info → academic info → payment)
  - File upload for payment proof
  - Real-time form validation
  - Payment option selection (full/installment)
  - Auto-generated santri ID
  - WhatsApp integration for confirmation
  - Success page with next steps
- **Access**: Public (no authentication required)
- **Status**: Creates santri with `statusAktif: 'Pending'` awaiting verification

#### **Login Page** (`/login/page.tsx`)
- **Purpose**: Authentication entry point
- **Features**:
  - Role selection (Staff/Wali Santri)
  - Email/password login for staff
  - Google OAuth for staff
  - Name + phone login for wali santri
  - Progressive validation (check name → check phone)
  - Error handling and user feedback
- **Access**: Public

---

### Wali Santri Pages

#### **Payment History** (`/payment-history/page.tsx`)
- **Purpose**: View and manage payments for their child
- **Features**:
  - Display all payment invoices (one-time and recurring vouchers)
  - Payment status indicators (Lunas, Belum Lunas, Menunggu Verifikasi)
  - Upload payment proof with notes
  - View payment history timeline
  - Download/view payment receipts
- **Access**: Role = `waliSantri` only
- **Component**: Uses `PaymentHistory` component

#### **My Vouchers** (`/my-vouchers/page.tsx`)
- **Purpose**: View recurring monthly voucher bills
- **Features**:
  - List of monthly bills assigned to santri
  - Payment status per voucher
  - Historical payment records
  - Payment submission
- **Access**: Role = `waliSantri` only

#### **Izin Santri - List** (`/izin-santri/page.tsx`)
- **Purpose**: Manage leave/sick permission requests
- **Features**:
  - View all submitted permissions
  - Create new permission request
  - Delete pending requests
  - Status tracking (multi-stage approval)
  - Card-based display with color-coded status
- **Access**: Role = `waliSantri` only

#### **Izin Santri - New** (`/izin-santri/new/page.tsx`)
- **Purpose**: Create new permission request
- **Features**:
  - Select permission type (Sakit/Pulang)
  - Date range selection
  - Reason description
  - Upload supporting documents (medical certificate, etc.)
  - Real-time validation
- **Access**: Role = `waliSantri` only

#### **Izin Santri - Detail** (`/izin-santri/[id]/page.tsx`)
- **Purpose**: View detailed permission request
- **Features**:
  - Full request information
  - Approval timeline
  - Document viewer
  - Status updates
  - Comments from reviewers
- **Access**: Role = `waliSantri` only

---

### Staff Pages (Pengurus/Pengasuh/Super Admin)

#### **Rekapitulasi** (`/rekapitulasi/page.tsx`)
- **Purpose**: Main dashboard for payment invoice management
- **Features**:
  - List all payment invoices
  - Create new invoice (tagihan)
  - View payment statistics (paid, waiting verification, total invoiced)
  - Delete invoices
  - Click to view detailed payment status
  - Export capabilities
  - Invoice editing (add santri to existing invoices)
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`
- **Key Components**: Uses `TagihanModal`, `RekapDetailView`

#### **Rekapitulasi Detail** (`/rekapitulasi/detail/[id]/page.tsx`)
- **Purpose**: Detailed view of specific invoice
- **Features**:
  - List all santri assigned to invoice
  - Individual payment status
  - Verify submitted payments
  - View payment proof images
  - Reject payments with reason
  - Cancel verified payments
  - Bulk operations
  - Excel export
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`

#### **Data Santri** (`/data-santri/page.tsx`)
- **Purpose**: Comprehensive student data management
- **Features**:
  - View all santri with filters (class, status, payment status, room)
  - Add new santri manually
  - Edit santri information
  - Delete santri (with cleanup of related records)
  - Verify pending registrations
  - Bulk import from CSV/Excel
  - Bulk delete with progress tracking
  - Export to Excel
  - Sorting and search functionality
  - Payment status verification modal
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`
- **Key Components**: `SantriForm`, `SantriModal`, `SantriVerificationModal`, `CSVImportModal`, `ImportProgressPanel`

#### **Attendance** (`/attendance/page.tsx`)
- **Purpose**: Main attendance dashboard
- **Features**:
  - Session selector (Morning/Afternoon/Evening)
  - Late return alerts
  - Network status indicator
  - Access to attendance history and reports
  - Teacher info display
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`
- **Key Components**: `SessionSelector`, `LateReturnAlerts`, `NetworkStatusIndicator`

#### **Attendance Session** (`/attendance/[sessionId]/page.tsx`)
- **Purpose**: Record attendance for specific session
- **Features**:
  - Mark santri as present/izin/alpha
  - Record return time for santri
  - Late return tracking
  - Real-time updates
  - Auto-save functionality
  - Session summary statistics
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`

#### **Attendance History** (`/attendance/history/page.tsx`)
- **Purpose**: View past attendance sessions
- **Features**:
  - List all completed sessions
  - Filter by date and session type
  - Edit historical records
  - Session statistics
  - Export to Excel
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`

#### **Attendance Report** (`/attendance/report/page.tsx`)
- **Purpose**: Generate attendance reports
- **Features**:
  - Date range selection
  - Attendance summary by santri
  - Export to Excel
  - Visual statistics
  - Filter by class/room
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`

#### **Voucher Asrama** (`/voucher-asrama/page.tsx`)
- **Purpose**: Manage recurring monthly vouchers
- **Features**:
  - Create voucher groups
  - Assign santri to vouchers
  - Set recurrence (monthly)
  - View voucher statistics
  - Bulk voucher creation with progress tracking
  - Edit and delete vouchers
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`
- **Key Components**: `VoucherCreationModal`, `VoucherGroupDetailsModal`, `VoucherProgressModal`

#### **Izin Admin** (`/izin-admin/page.tsx`)
- **Purpose**: Review and approve permission requests
- **Features**:
  - List all permission requests
  - Filter by status and type
  - Multi-stage approval workflow
  - Approve/reject requests with comments
  - View supporting documents
  - Export reports
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`

#### **Izin Admin Detail** (`/izin-admin/[id]/page.tsx`)
- **Purpose**: Detailed permission review
- **Features**:
  - Full request information
  - Document viewer
  - Approval/rejection forms
  - History of approvals
  - Status updates
- **Access**: Role = `pengurus`, `pengasuh`, or `superAdmin`

#### **User Management** (`/user-management/page.tsx`)
- **Purpose**: Create and manage staff accounts
- **Features**:
  - Add new pengurus/pengasuh accounts
  - Set user roles
  - View existing users
  - Deactivate accounts
  - Role assignment
- **Access**: Role = `superAdmin` only
- **Key Feature**: Uses Firebase authentication for account creation

---

## 🔄 Workflows

### 1. New Santri Registration Workflow
```
1. Visitor accesses homepage → Clicks "Daftar Sekarang"
2. Fills registration form (3 steps)
   - Step 1: Personal Information
   - Step 2: Academic Information
   - Step 3: Payment Option & Proof Upload
3. Submit form → Data saved to SantriCollection (status: "Pending")
4. Success page displayed with WhatsApp confirmation link
5. Admin reviews in Data Santri page
6. Admin verifies → Status changed to "Aktif"
7. Santri can now be assigned to invoices/vouchers
8. Wali Santri can login with santri name + phone
```

### 2. Payment Invoice Workflow
```
1. Admin creates payment invoice (Tagihan) from Rekapitulasi page
2. Selects santri to be invoiced
3. Invoice created → PaymentStatus records generated for each santri
4. Wali Santri sees invoice in Payment History
5. Wali uploads payment proof with notes
6. Status changes to "Menunggu Verifikasi"
7. Admin reviews in Rekapitulasi Detail
8. Admin verifies → Status changes to "Lunas" (Paid)
   OR Admin rejects → Status back to "Belum Lunas" with reason
9. Payment history recorded with timestamps
```

### 3. Monthly Voucher Workflow
```
1. Admin creates Voucher Group from Voucher Asrama page
2. Names voucher (e.g., "SPP Mei 2025")
3. Sets amount and recurrence (monthly)
4. Selects santri to be assigned
5. Voucher created → PaymentStatus records generated
6. Wali Santri sees voucher in My Vouchers/Payment History
7. Follows same verification process as payment invoice
8. Monthly recurrence auto-generates new bills
```

### 4. Attendance Recording Workflow
```
1. Pengurus opens Attendance page
2. Selects session type (Pagi/Siang/Sore)
3. Creates new session or continues existing
4. System displays list of active santri
5. Pengurus marks attendance status:
   - Hadir (Present)
   - Izin (Permitted absence)
   - Alpha (Absent without permission)
6. For santri going out, records expected return time
7. Records actual return time
8. Alerts shown for late returns
9. Session closed → Saved to AttendanceSession collection
10. Available in Attendance History for review
```

### 5. Permission Request Workflow
```
1. Wali Santri creates permission request from Izin Santri page
2. Selects type (Sakit/Pulang)
3. Sets date range and reason
4. Uploads supporting documents
5. Submits → Status: "Menunggu Persetujuan Ustadzah"
6. Pengasuh reviews in Izin Admin
7. Pengasuh approves → Status updates to next stage
   OR Pengasuh rejects → Process ends with rejection reason
8. Multi-stage approval (can have multiple reviewers)
9. Final approval → Permission granted
10. Wali can track status in Izin Santri detail page
```

### 6. CSV Import Workflow (Bulk Santri)
```
1. Admin clicks Import CSV in Data Santri
2. Downloads template (optional)
3. Selects CSV file with santri data
4. System validates data
5. Preview displayed with validation errors
6. Admin confirms import
7. Progress panel shows:
   - Processing progress
   - Success count
   - Error details
8. Santri records created in batches
9. Summary report displayed
10. Option to download error log
```

---

## 🏗️ Technical Architecture

### Frontend Stack
- **Framework**: Next.js 15.2.1 (App Router)
- **React**: 18.3.1
- **TypeScript**: 5.x
- **Styling**: Tailwind CSS 3.3.0
- **UI Components**: 
  - @headlessui/react (modals, dialogs)
  - @heroicons/react (icons)
  - @tailwindcss/forms (form styling)
- **State Management**: Zustand 5.0.3
- **Theme**: next-themes 0.4.6 (dark mode support)
- **Toast Notifications**: react-hot-toast 2.5.2
- **Date Picker**: react-datepicker 6.0.0
- **Icons**: react-icons 5.5.0
- **Excel Operations**: xlsx 0.18.5

### Backend Stack
- **Database**: Firebase Firestore (NoSQL)
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage (for images/documents)
- **Cloud Functions**: For server-side operations
- **Hosting**: Vercel (likely, based on Next.js setup)

### Key Libraries & Utilities

#### Custom Utilities
- **Name Formatter** (`/src/utils/nameFormatter.ts`): Capitalizes Indonesian names properly
- **Excel Export** (`/src/utils/excelExport.ts`): Export data to Excel format
- **Date Formatters**: Consistent date/time formatting across app

#### Firebase Integration
- **Config** (`/src/firebase/config.ts`): Firebase initialization
- **Auth** (`/src/firebase/auth.tsx`): Authentication context and hooks
- **Attendance** (`/src/firebase/attendance.ts`): Attendance CRUD operations
- **Izin** (`/src/firebase/izinSakitPulang.ts`): Permission request operations

#### Components
- **Modals**: Payment, Tagihan, Voucher, Santri verification, CSV import
- **Forms**: SantriForm, dynamic validation
- **Tables**: Sortable, filterable data tables with sticky headers
- **Cards**: Izin cards, dashboard cards
- **Navigation**: Navbar with role-based menu items

### State Management
- **Zustand Store**: Used for attendance state
- **React Context**: Auth context for user data
- **Local State**: Component-level useState for UI state
- **localStorage**: Wali Santri session persistence

### File Structure
```
esantren_web_chosyiah-main/
├── public/                    # Static assets (images, icons)
├── src/
│   ├── app/                   # Next.js app router pages
│   │   ├── attendance/        # Attendance pages
│   │   ├── data-santri/       # Student data management
│   │   ├── izin-admin/        # Admin permission pages
│   │   ├── izin-santri/       # Santri permission pages
│   │   ├── login/             # Login page
│   │   ├── my-vouchers/       # Wali voucher view
│   │   ├── payment-history/   # Wali payment page
│   │   ├── registration/      # Registration page
│   │   ├── rekapitulasi/      # Payment invoice pages
│   │   ├── user-management/   # User admin
│   │   ├── voucher-asrama/    # Voucher management
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Homepage
│   ├── components/            # Reusable React components
│   ├── constants/             # App constants (KODE_ASRAMA)
│   ├── context/               # React contexts
│   ├── firebase/              # Firebase configuration & services
│   ├── styles/                # Global styles
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── firebase-rules/            # Firestore security rules
├── functions/                 # Firebase Cloud Functions
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 🎨 Design & UX

### Theme
- **Primary Colors**: Amber/Gold palette (representing Islamic/traditional values)
- **Dark Mode**: Full support using next-themes
- **Responsive**: Mobile-first design, optimized for all screen sizes
- **Accessibility**: ARIA labels, keyboard navigation support

### UI Patterns
- **Modals**: For forms and confirmations
- **Toast Notifications**: For user feedback
- **Loading States**: Spinners and skeleton screens
- **Progress Indicators**: For bulk operations
- **Status Badges**: Color-coded payment and permission statuses
- **Sticky Headers**: For data tables
- **Horizontal Scroll**: For wide tables on mobile

### Color Coding
- **Green**: Lunas (Paid), Approved, Active
- **Yellow/Amber**: Menunggu Verifikasi (Waiting Verification), Pending
- **Red**: Belum Lunas (Unpaid), Rejected, Inactive
- **Blue**: Information, Links
- **Gray**: Disabled, Neutral

---

## 🔒 Security & Permissions

### Security Rules
- Firebase Security Rules defined in `/firebase-rules/`
- Role-based access control (RBAC)
- Client-side route guards (useAuth hook)
- Server-side validation in Cloud Functions

### Permission Matrix
| Feature | Wali Santri | Pengurus | Pengasuh | Super Admin |
|---------|-------------|----------|----------|-------------|
| View Own Payment | ✅ | ❌ | ❌ | ✅ |
| Submit Payment | ✅ | ❌ | ❌ | ❌ |
| Verify Payment | ❌ | ✅ | ✅ | ✅ |
| Create Invoice | ❌ | ✅ | ✅ | ✅ |
| Manage Santri Data | ❌ | ✅ | ✅ | ✅ |
| Record Attendance | ❌ | ✅ | ✅ | ✅ |
| Submit Permission | ✅ | ❌ | ❌ | ❌ |
| Approve Permission | ❌ | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | ✅ |
| System Config | ❌ | ❌ | ❌ | ✅ |

---

## 📊 Key Data Models

### Santri (Student)
```typescript
{
  id: string;
  nama: string;
  kamar: string;
  kelas: string;
  tahunMasuk: string;
  nomorWalisantri: string;
  statusTanggungan: 'Lunas' | 'Belum Lunas' | 'Belum Ada Tagihan' | 'Menunggu Verifikasi';
  statusAktif: 'Aktif' | 'Boyong' | 'Lulus' | 'Dikeluarkan' | 'Pending' | 'Ditolak';
  tanggalLahir: string;
  kodeAsrama: string;
  nomorTelpon?: string;
  // ... additional fields
}
```

### Payment Status
```typescript
{
  id: string;
  invoiceId: string;
  paymentName: string;
  santriId: string;
  status: 'Belum Lunas' | 'Menunggu Verifikasi' | 'Lunas';
  paid: number;
  total: number;
  history: Record<string, PaymentHistoryItem>;
  // ... additional fields
}
```

### Attendance Record
```typescript
{
  sessionId: string;
  kodeAsrama: string;
  date: string;
  sessionType: 'Pagi' | 'Siang' | 'Sore';
  teacherId: string;
  teacherName: string;
  attendanceRecords: {
    [santriId: string]: {
      status: 'Hadir' | 'Izin' | 'Alpha';
      returnTime?: Timestamp;
      expectedReturn?: Timestamp;
      isLate?: boolean;
    }
  }
}
```

### Permission Request
```typescript
{
  id: string;
  santriId: string;
  santriNama: string;
  type: 'Sakit' | 'Pulang';
  startDate: Timestamp;
  endDate: Timestamp;
  reason: string;
  status: string; // Multi-stage workflow
  documentUrls: string[];
  approvals: Array<{
    by: string;
    date: Timestamp;
    decision: 'Approved' | 'Rejected';
    comments?: string;
  }>;
}
```

---

## 🚀 Deployment & Development

### Development Commands
```bash
npm run dev          # Start development server (with Turbo)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Build Configuration
- **Next.js Config**: Configured for image optimization, turbo mode
- **Tailwind Config**: Custom theme with amber palette, dark mode class strategy
- **TypeScript**: Strict mode enabled
- **PostCSS**: With autoprefixer

---

## 🔮 Future Enhancements (Potential)

Based on the codebase structure, potential areas for expansion:
- SMS notifications for payment reminders
- Email integration for receipts
- Advanced analytics dashboard
- Mobile app (React Native)
- Automated monthly voucher generation
- Integration with campus student information system
- Online tutoring/mentoring scheduling
- Facility booking system
- Digital library access

---

## 📞 Contact & Support

**Asrama Mahasiswi Chosyi'ah**  
PP. Darul Ulum, Rejoso  
Jl. KH. Moh. As'ad Umar  
Wonokerto Selatan, Peterongan  
Kabupaten Jombang, Jawa Timur 61481

**Registration Inquiries:**
- Ustadzah Rani: 0852-3247-9151
- Ustadzah Nuril: 0812-3396-8261

**Phone:** (0321) 866686

---

## 👨‍💻 Developer Notes

### Key Points for New Developers

1. **Name Handling**: Indonesian names require special capitalization logic (see `nameFormatter.ts`)
2. **Wali Santri Auth**: Unique authentication without Firebase Auth - uses localStorage
3. **Kode Asrama**: Hardcoded as `ASR11` in constants - change if deploying for other dormitories
4. **Payment Status**: Always check both `PaymentInvoice` and `PaymentStatus` collections
5. **Timestamps**: Mix of Firestore Timestamps and string dates - always validate
6. **File Uploads**: All uploads go to Firebase Storage with organized folder structure
7. **Role Checking**: Always verify user role before rendering components/routes
8. **Dark Mode**: Use Tailwind's `dark:` prefix for all styling

### Common Patterns
- **Loading States**: Display spinner while `loading` is `true`
- **Error Handling**: Use try-catch with toast notifications
- **Modal Management**: Boolean state + modal component
- **Data Fetching**: useEffect with dependency array
- **Form Validation**: Client-side validation before Firestore write

### Testing Recommendations
- Test all payment workflows (create, verify, reject, cancel)
- Test bulk operations (import, delete) with various data sizes
- Test permission workflow across all approval stages
- Test attendance recording with late returns
- Test all authentication flows
- Test responsive design on mobile devices
- Test dark mode on all pages

---

## 📝 Changelog Tracking

For production deployments, consider maintaining:
- Version numbers (semantic versioning)
- Feature additions
- Bug fixes
- Breaking changes
- Database schema changes

---

**Last Updated:** December 7, 2025  
**Document Version:** 1.0  
**Maintained By:** Development Team, puskomNet Unipdu
