# TimeTrack Application - Complete Features List

## 1. **index.html** - Login Page
- Store login (IP-restricted)
- Manager login (username/password only)
- Super Admin login
- Session management
- Auto-redirect based on role

## 2. **dashboard.html** - Store Dashboard
- Welcome message
- Navigation to: Time Clock, Inventory, End of Day
- User info display
- Logout functionality

## 3. **super-admin.html** - Super Admin Dashboard
- View all managers in grid layout
- Search managers by name or username
- Manager cards with initials avatar
- Click to view manager dashboard
- Edit manager button on each card
- Add Manager button
- Empty state when no managers
- Loading states

## 4. **manager.html** - Manager Dashboard
- View all stores assigned to manager
- Add Store modal with:
  - Store name, total boxes, username, password
  - IP address locking (current IP)
- Edit Store modal with:
  - Update store details
  - Option to update IP address
- Store cards display
- View as super-admin (when viewing another manager's stores)
- Navigation to: Add Employee, List Employees

## 5. **add-manager.html** - Add/Edit Manager
- Add new manager form
- Edit existing manager (via URL parameter)
- Fields: Name, Username, Password, Confirm Password
- Password optional in edit mode
- Username disabled in edit mode
- Error display with prominent styling
- Success/error status messages
- Auto-redirect after success

## 6. **add-employee.html** - Add Employee
- Employee form with:
  - Name (required)
  - Role
  - Phone number
  - Hourly pay
- Face registration using camera:
  - Start/stop camera
  - Capture face with face-api.js
  - Retake photo
  - Face detection validation
  - Face descriptor storage
- Duplicate face detection
- Error handling with prominent display
- Auto-redirect to list after success

## 7. **list-employees.html** - List Employees
- Grid view of all employees
- Search employees by name, role, or store
- Employee cards showing:
  - Face image or initials avatar
  - Name, role
  - Phone number
  - Hourly pay
- Click card to view employee activities
- Remove employee button
- Empty state
- Loading states

## 8. **timeclock.html** - Time Clock
- Real-time clock display
- Clock In button
- Clock Out button
- Face recognition for clock in/out:
  - Camera access
  - Live face detection overlay
  - Capture face button
  - Photo preview
  - Recognition result display
  - Confirm/Retake options
- Loading indicators
- Status messages
- Face-api.js integration

## 9. **inventory.html** - Inventory Management (Store View)
- Inventory table with:
  - Device name
  - SKU
  - Current quantity
  - Stage (input field)
- Add Item modal:
  - Item name
  - SKU
  - Initial quantity
- Edit Item modal
- Search items by name or SKU
- Submit Inventory Snapshot button
- Bulk update functionality

## 10. **eod.html** - End of Day Submission
- Cash Amount input
- Credit Amount input
- Boxes Count input
- QPay Amount input
- Total1 input
- Notes textarea
- Submit End of Day button
- Input validation (numeric/decimal)

## 11. **store-employees.html** - Store Employees (Manager View)
- List employees for a store
- View Inventory button
- View EODs button
- Basic employee information display

## 12. **store-inventory.html** - Store Inventory (Manager View)
- Inventory table (read-only for manager)
- Add Item button
- Search functionality
- Edit Item modal
- Back to Manager button
- No submit button (view-only)

## 13. **store-eod.html** - Store EODs (Manager View)
- List of EOD submissions for a store
- Basic EOD information display

## 14. **employee-activities.html** - Employee Activities
- Employee info card with:
  - Name, role, store
  - Total hours worked
  - Earnings calculation (if hourly pay set)
- Statistics cards:
  - Total days
  - Total hours
  - Average hours/day
  - Completed shifts
- Activity history table with:
  - Date and day
  - Clock in time
  - Clock out time
  - Hours worked
  - Store name
  - Status (Active/Complete)
- Date range filtering:
  - Start date picker
  - End date picker
  - Apply filter button
  - Clear filter button
- Download Excel export:
  - All activity data
  - Summary totals
  - Date range in filename
- Back button
- Loading states
- Empty states

## 15. **store-employees-today.html** - Employees Working Today
- List employees clocked in today
- Real-time status (Active/Clocked Out)
- Clock in/out times
- Hours worked display
- Face recognition confidence scores
- Refresh button
- Auto-refresh every 30 seconds
- View Employee History button
- Back to Stores button
- Date display
- Total entries count

## 16. **store-employees-history.html** - Employee Attendance History
- Attendance records grouped by date
- Filter by days (7, 30, 60, 90)
- Clock in/out times
- Hours worked
- Status indicators
- Click employee name to view activities
- Refresh button
- Back to Today button
- Total entries count

## 17. **store-inventory-history.html** - Inventory History
- Period cards view (11-day periods with 1-day overlap)
- Grid view showing:
  - Items as rows
  - Dates as columns
  - Quantities in cells
  - Phones total row
  - Simcards total row
- View period button
- Download Excel for period
- Download Excel for current grid view
- Auto-refresh every 10 seconds (cards view only)
- Refresh button
- Back to Store button
- Back to Cards button (when viewing grid)
- Sticky headers and item column
- Empty cell indicators

## 18. **store-eod-list.html** - EOD Reports List
- List of EOD submissions
- Back to Store button
- Basic EOD information display

## 19. **store-eod-detail.html** - EOD Report Detail
- Detailed view of single EOD submission
- Back to List button
- Full EOD data display

## 20. **view-inventory-snapshot.html** - View Inventory Snapshot
- Single snapshot view
- Store name and date
- Item table with:
  - SKU
  - Name
  - Quantity
- Total items count
- Total quantity
- Back to History button
- Formatted date display

---

## Common Features Across Pages

### Navigation
- Navbar with logo
- Role-based navigation links
- Logout button
- Breadcrumb navigation

### Authentication & Authorization
- Session management
- Role-based access control (store, manager, super-admin)
- Auto-redirect on unauthorized access

### UI/UX
- Responsive design
- Loading states
- Empty states
- Error messages
- Success notifications
- Modal dialogs
- Card-based layouts
- Grid layouts
- Table views

### Data Management
- Search functionality
- Filtering
- Sorting
- Pagination (where applicable)
- Real-time updates (auto-refresh)

### Export Features
- Excel download (XLSX format)
- Date range in filenames
- Formatted data export

### Face Recognition
- Face-api.js integration
- Camera access
- Face detection
- Face descriptor storage
- Duplicate detection
- Confidence scoring

### Security
- IP-based store login restriction
- Password hashing
- Session tokens
- Input validation
- XSS protection (escapeHtml)






