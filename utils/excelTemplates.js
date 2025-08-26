const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Create templates directory if it doesn't exist
const templatesDir = path.join(__dirname, '../templates');
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

// Helper function to create a template with proper formatting
const createTemplate = async (data, headers, sheetName, fileName) => {
  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'School Management System';
    workbook.lastModifiedBy = 'School Management System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Add a worksheet
    const worksheet = workbook.addWorksheet(sheetName);

    // Add column headers with formatting
    worksheet.columns = headers.map((header, index) => ({
      header,
      key: Object.keys(data)[index] || `col${index}`,
      width: Math.max(25, header.length * 1.2)
    }));

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' } // Light gray
    };

    // Highlight required fields in the header
    headers.forEach((header, index) => {
      if (header.includes('REQUIRED')) {
        const cell = worksheet.getRow(1).getCell(index + 1);
        cell.font = {
          bold: true,
          color: { argb: 'FFFF0000' } // Red color for required fields
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFDDDD' } // Light red background
        };
      }
    });

    // Add sample data row
    worksheet.addRow(data);

    // Style the data row
    worksheet.getRow(2).font = { italic: true };
    worksheet.getRow(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF0E0' } // Light orange
    };

    // Add instructions row
    worksheet.addRow({});
    worksheet.getRow(3).getCell(1).value = 'IMPORTANT: Fields marked as REQUIRED must be filled in. The sample data in row 2 is for reference only. DO NOT EDIT THIS ROW.';
    worksheet.getRow(3).getCell(1).font = { bold: true, color: { argb: 'FFFF0000' } };
    worksheet.mergeCells(3, 1, 3, headers.length);
    worksheet.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEEEE' } // Very light red background
    };

    // Add a blank row with clear instructions
    worksheet.addRow({});
    worksheet.getRow(4).getCell(1).value = '--- ADD YOUR DATA BELOW THIS LINE ---';
    worksheet.getRow(4).getCell(1).font = { bold: true, color: { argb: 'FF0000FF' } }; // Blue
    worksheet.mergeCells(4, 1, 4, headers.length);
    worksheet.getRow(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEEEFF' } // Very light blue background
    };

    // Add an empty row for the user to fill in
    const emptyRow = {};
    Object.keys(data).forEach(key => {
      emptyRow[key] = '';
    });
    worksheet.addRow(emptyRow);

    // Style the empty row
    worksheet.getRow(5).font = { bold: false };
    worksheet.getRow(5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' } // White background
    };

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Write the workbook to a file
    const filePath = path.join(templatesDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    console.log(`${sheetName} template generated successfully at ${filePath}`);
    return true;
  } catch (err) {
    console.error(`Error generating ${sheetName} template:`, err);
    return false;
  }
};

// Generate student template
const generateStudentTemplate = async () => {
  const sampleData = {
    firstName: 'John',
    middleName: '',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    rollNumber: 'STU001',
    class: '10',
    section: 'A',
    gender: 'male',
    dateOfBirth: '2005-01-15',
    monthlyFee: '5000',
    fatherName: 'James Doe',
    motherName: 'Jane Doe',
    guardianName: '',
    contactNumber: '1234567890',
    parentEmail: 'parent@example.com',
    occupation: 'Engineer',
    street: '123 Main St',
    city: 'Anytown',
    state: 'State',
    zipCode: '12345',
    country: 'Country',
    admissionDate: '2022-04-01'
  };

  // Column headers with instructions
  const headers = [
    'firstName (REQUIRED)',
    'middleName (Optional)',
    'lastName (REQUIRED)',
    'email (REQUIRED, must be unique)',
    'rollNumber (REQUIRED, must be unique)',
    'class (REQUIRED)',
    'section (REQUIRED)',
    'gender (REQUIRED: male/female/other)',
    'dateOfBirth (YYYY-MM-DD)',
    'monthlyFee (REQUIRED)',
    'fatherName (REQUIRED)',
    'motherName (REQUIRED)',
    'guardianName (Optional)',
    'contactNumber (REQUIRED)',
    'parentEmail (Optional)',
    'occupation (Optional)',
    'street (Optional)',
    'city (Optional)',
    'state (Optional)',
    'zipCode (Optional)',
    'country (Optional)',
    'admissionDate (YYYY-MM-DD, Optional)'
  ];

  return await createTemplate(sampleData, headers, 'Students', 'student-template.xlsx');
};

// Generate teacher template
const generateTeacherTemplate = async () => {
  const sampleData = {
    firstName: 'Jane',
    middleName: '',
    lastName: 'Smith',
    phoneNumber: '9876543210',
    qualification: 'M.Sc., B.Ed.',
    experience: '5',
    subjects: 'Mathematics,Physics',
    classes: '9,10,11',
    gender: 'female',
    dateOfBirth: '1985-05-20',
    salary: '50000',
    street: '456 Oak St',
    city: 'Anytown',
    state: 'State',
    zipCode: '12345',
    country: 'Country',
    joiningDate: '2020-06-15'
  };

  // Column headers with instructions
  const headers = [
    'firstName (Required)',
    'middleName (Optional)',
    'lastName (Required)',
    'phoneNumber (Required)',
    'qualification (Required)',
    'experience (Required, in years)',
    'subjects (Required, comma-separated)',
    'classes (Optional, comma-separated)',
    'gender (Required: male/female/other)',
    'dateOfBirth (YYYY-MM-DD)',
    'salary (Required)',
    'street (Optional)',
    'city (Optional)',
    'state (Optional)',
    'zipCode (Optional)',
    'country (Optional)',
    'joiningDate (YYYY-MM-DD, Optional)'
  ];

  return await createTemplate(sampleData, headers, 'Teachers', 'teacher-template.xlsx');
};

// Generate admin staff template
const generateAdminStaffTemplate = async () => {
  const sampleData = {
    firstName: 'Robert',
    middleName: '',
    lastName: 'Johnson',
    email: 'robert.johnson@example.com',
    employeeId: 'ADM001',
    phoneNumber: '5551234567',
    qualification: 'MBA',
    experience: '8',
    position: 'Administrator',
    department: 'Administration',
    gender: 'male',
    dateOfBirth: '1980-03-10',
    salary: '60000',
    responsibilities: 'Budget Management,Staff Coordination,Reporting',
    street: '789 Pine St',
    city: 'Anytown',
    state: 'State',
    zipCode: '12345',
    country: 'Country',
    joiningDate: '2018-01-10',
    role: 'admin'
  };

  // Column headers with instructions
  const headers = [
    'firstName (Required)',
    'middleName (Optional)',
    'lastName (Required)',
    'email (Required, must be unique)',
    'employeeId (Required, must be unique)',
    'phoneNumber (Required)',
    'qualification (Required)',
    'experience (Required, in years)',
    'position (Required)',
    'department (Required)',
    'gender (Required: male/female/other)',
    'dateOfBirth (YYYY-MM-DD)',
    'salary (Required)',
    'responsibilities (Optional, comma-separated)',
    'street (Optional)',
    'city (Optional)',
    'state (Optional)',
    'zipCode (Optional)',
    'country (Optional)',
    'joiningDate (YYYY-MM-DD, Optional)',
    'role (Optional: admin/principal/vice-principal, defaults to admin)'
  ];

  return await createTemplate(sampleData, headers, 'Admin Staff', 'admin-staff-template.xlsx');
};

// Generate support staff template
const generateSupportStaffTemplate = async () => {
  const sampleData = {
    firstName: 'Michael',
    middleName: '',
    lastName: 'Brown',
    email: 'michael.brown@example.com',
    employeeId: 'SUP001',
    phoneNumber: '5559876543',
    position: 'security',
    experience: '3',
    gender: 'male',
    dateOfBirth: '1990-11-25',
    salary: '25000',
    startTime: '08:00',
    endTime: '16:00',
    daysOfWeek: 'Monday,Tuesday,Wednesday,Thursday,Friday',
    emergencyName: 'Sarah Brown',
    emergencyRelationship: 'Spouse',
    emergencyPhone: '5551112222',
    street: '321 Elm St',
    city: 'Anytown',
    state: 'State',
    zipCode: '12345',
    country: 'Country',
    joiningDate: '2021-03-15'
  };

  // Column headers with instructions
  const headers = [
    'firstName (Required)',
    'middleName (Optional)',
    'lastName (Required)',
    'email (Required, must be unique)',
    'employeeId (Required, must be unique)',
    'phoneNumber (Required)',
    'position (Required: janitor/security/gardener/driver/cleaner/cook/other)',
    'experience (Required, in years)',
    'gender (Required: male/female/other)',
    'dateOfBirth (YYYY-MM-DD)',
    'salary (Required)',
    'startTime (Optional, HH:MM)',
    'endTime (Optional, HH:MM)',
    'daysOfWeek (Optional, comma-separated)',
    'emergencyName (Optional)',
    'emergencyRelationship (Optional)',
    'emergencyPhone (Optional)',
    'street (Optional)',
    'city (Optional)',
    'state (Optional)',
    'zipCode (Optional)',
    'country (Optional)',
    'joiningDate (YYYY-MM-DD, Optional)'
  ];

  return await createTemplate(sampleData, headers, 'Support Staff', 'support-staff-template.xlsx');
};

// Generate all templates
const generateAllTemplates = async () => {
  try {
    await generateStudentTemplate();
    await generateTeacherTemplate();
    await generateAdminStaffTemplate();
    await generateSupportStaffTemplate();
    console.log('All templates generated successfully');
    return true;
  } catch (err) {
    console.error('Error generating templates:', err);
    return false;
  }
};

// Export functions
module.exports = {
  generateStudentTemplate,
  generateTeacherTemplate,
  generateAdminStaffTemplate,
  generateSupportStaffTemplate,
  generateAllTemplates
};

// Generate templates when this file is run directly
if (require.main === module) {
  generateAllTemplates().then(() => {
    console.log('Template generation complete');
  }).catch(err => {
    console.error('Template generation failed:', err);
  });
}
