import pandas as pd
import json
from pathlib import Path

def excel_to_json(excel_file, output_dir=None, prefix=None, sheets=None, header_row=0, id_field="id", columns=None, consolidated=True):
    """
    Read worksheets from an Excel file and generate JSON output
    
    Args:
        excel_file (str): Path to the Excel file
        output_dir (str): Output directory, defaults to 'output' folder in current directory
        prefix (str): Output filename prefix, defaults to Excel filename
        sheets (list): List of sheet names to process, defaults to all sheets
        header_row (int): Row index to use as field names (0-based), defaults to 0
        id_field (str): Name of the ID field to add to each JSON object, defaults to "id"
        columns (list): List of columns to include in the JSON output, defaults to all columns
        consolidated (bool): Generate a single consolidated JSON file instead of individual files per row
    """
    # Create output directory
    if output_dir is None:
        output_dir = Path('output')
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(exist_ok=True)
    
    # Set filename prefix
    if prefix is None:
        prefix = Path(excel_file).stem
    
    # Read all worksheets from Excel file
    excel = pd.ExcelFile(excel_file)
    all_sheet_names = excel.sheet_names
    
    # Determine which sheets to process
    if sheets is None:
        sheet_names = all_sheet_names
    else:
        sheet_names = [s for s in sheets if s in all_sheet_names]
        if not sheet_names:
            print(f"Warning: None of the specified sheets {sheets} were found in the Excel file.")
            print(f"Available sheets: {', '.join(all_sheet_names)}")
            return
    
    print(f"Found {len(sheet_names)} sheets to process: {', '.join(sheet_names)}")
    
    # Dictionary to store all data if using consolidated mode
    consolidated_data = {}
    file_counter = 0
    
    # Process each worksheet
    for sheet_name in sheet_names:
        print(f"Processing sheet: {sheet_name}")
        
        # Read worksheet data with specified header row
        df = pd.read_excel(excel, sheet_name=sheet_name, header=header_row)

        print(df.head())
        
        # Ensure DataFrame is not empty
        if df.empty:
            print(f"  Sheet '{sheet_name}' is empty, skipping")
            continue
        
        # Filter columns if specified
        if columns is not None:
            def is_valid_column(columns):
                for col in columns:
                    if not isinstance(col, str) or len(col) > 3 or col.upper()[0] not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
                        return False
                return True

            if is_valid_column(columns):
                # Convert Excel column letters to 0-based column indices
                col_indices = []
                for col in columns:
                    col_idx = 0
                    for i, char in enumerate(reversed(col.upper())):
                        col_idx += (ord(char) - ord('A') + 1) * (26 ** i)
                    col_indices.append(col_idx - 1)  # Convert to 0-based index
                
                # Select columns by position (iloc)
                df = df.iloc[:, col_indices]
            else:
                # Select columns by name (if columns contain actual column names)
                try:
                    df = df[columns]
                except KeyError:
                    print(f"Warning: Some columns {columns} not found in sheet '{sheet_name}'")
                    print(f"Available columns: {', '.join(map(str, df.columns))}")
                    # Use only the columns that exist
                    existing_columns = [col for col in columns if col in df.columns]
                    if existing_columns:
                        df = df[existing_columns]
                    else:
                        print(f"No valid columns found, using all columns")
        
        # Convert NaN values to None (null in JSON)
        df = df.where(pd.notnull(df), None)
        
        # Remove columns that contain only null values
        cols_to_drop = []
        for col in df.columns:
            if df[col].isna().all():
                print(f"  Column '{col}' contains only null values, skipping")
                cols_to_drop.append(col)
        
        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)
        
        # Process data for the sheet
        sheet_data = []
        skipped_rows = 0
        sequential_id = 0  # Initialize sequential ID counter
        current_tag = None  # Initialize tag
        
        for index, row in df.iterrows():
            # Convert row data to dictionary
            row_dict = row.to_dict()
            
            # Check if this is a "header" row (first column filled, others empty)
            first_column_value = None
            if len(row_dict) > 0:
                first_column_name = df.columns[0]
                first_column_value = row_dict[first_column_name]
                
                # Check if first column has value but others are None
                is_header_row = first_column_value is not None
                for key, value in row_dict.items():
                    if key != first_column_name and value is not None:
                        is_header_row = False
                        break
                
                if is_header_row:
                    # This is a header/tag row, update the current_tag
                    current_tag = first_column_value
                    # Skip this row since it's just a tag marker
                    continue
            
            # Check if all fields are null
            all_null = True
            for key, value in row_dict.items():
                if value is not None:
                    all_null = False
                    break
            
            # Skip row if all fields are null
            if all_null:
                skipped_rows += 1
                continue
            
            # Add current tag if available
            if current_tag is not None:
                row_dict["Tag"] = current_tag
            
            # Add sequential ID field
            row_dict[id_field] = sequential_id
            sequential_id += 1  # Increment ID for next valid row
                
            if consolidated:
                sheet_data.append(row_dict)
            else:
                # Create filename including sheet name
                file_name = f"{prefix}_{sheet_name}_row{index+1}.json"
                file_path = output_dir / file_name
                
                # Write JSON file
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(row_dict, f, ensure_ascii=False, indent=2)
                
                file_counter += 1
        
        if skipped_rows > 0:
            print(f"  Skipped {skipped_rows} rows where all content fields were null")
            
        if consolidated and sheet_data:  # Only add the sheet if it has non-empty rows
            consolidated_data[sheet_name] = sheet_data
            file_counter = 1
    
    # Write consolidated JSON file
    if consolidated:
        file_name = f"{prefix}_consolidated.json"
        file_path = output_dir / file_name
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(consolidated_data, f, ensure_ascii=False, indent=2)
        
        print(f"Complete! Generated consolidated JSON file with {len(consolidated_data)} sheets, saved as {file_path}")
    else:
        print(f"Complete! Generated {file_counter} JSON files, saved in {output_dir.absolute()} directory")


def main():
    excel_file = r"./PJS翻译资料.xlsx"
    output = "output"
    prefix = None
    sheets = ["乐曲一览"]
    header_row = 1
    id_field = "id"
    columns = ["A", "B"]  # Specify the columns to include
    
    # Execute conversion with consolidated option set to True
    excel_to_json(
        excel_file, 
        output, 
        prefix, 
        sheets, 
        header_row, 
        id_field,
        columns,
        consolidated=True  # Generate a single consolidated JSON file
    )

if __name__ == "__main__":
    main()