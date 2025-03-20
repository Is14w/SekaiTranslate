import pandas as pd
import json
from pathlib import Path

def excel_to_json(excel_file, output_dir=None, prefix=None, sheets=None, header_row=0, id_field="id", 
                 columns=None, consolidated=True, tag_column=None):
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
        tag_column (list or str): Column(s) to use for tag detection. If empty list, no tags will be added
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
        print(f"Original columns: {df.columns.tolist()}")
        
        # Ensure DataFrame is not empty
        if df.empty:
            print(f"  Sheet '{sheet_name}' is empty, skipping")
            continue
        
        # Make a copy of the full DataFrame for tag detection
        df_full = df.copy()
        
        # Convert Excel column letters to indices for both columns and tag_column
        data_col_indices = []
        tag_col_indices = []
        
        # Helper function to check if a value is an Excel column letter
        def is_excel_column(col):
            return isinstance(col, str) and len(col) <= 3 and col.upper()[0] in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        
        # Helper function to convert Excel column letter to 0-based index
        def excel_col_to_index(col):
            col_idx = 0
            for i, char in enumerate(reversed(col.upper())):
                col_idx += (ord(char) - ord('A') + 1) * (26 ** i)
            return col_idx - 1  # Convert to 0-based index
        
        # Process content columns
        if columns is not None:
            # Check if columns are Excel column letters
            if all(is_excel_column(col) for col in columns):
                for col in columns:
                    data_col_indices.append(excel_col_to_index(col))
                
                # Create a new DataFrame with only the specified columns
                if data_col_indices:
                    # Select columns that exist in the DataFrame
                    valid_indices = [idx for idx in data_col_indices if idx < len(df.columns)]
                    if valid_indices:
                        df = df.iloc[:, valid_indices]
                    else:
                        print(f"Warning: No valid column indices found in {data_col_indices}")
            else:
                # Try to use column names
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
        
        # Process tag columns
        tag_col_names = []
        if tag_column:
            tag_cols = [tag_column] if not isinstance(tag_column, (list, tuple, set)) else list(tag_column)
            
            # Check if tag columns are Excel column letters
            if all(is_excel_column(col) for col in tag_cols if col is not None):
                for col in tag_cols:
                    if col is None:
                        continue
                    tag_idx = excel_col_to_index(col)
                    tag_col_indices.append(tag_idx)
                
                # Get the column names from the original DataFrame
                for idx in tag_col_indices:
                    if idx < len(df_full.columns):
                        tag_col_names.append(df_full.columns[idx])
                    else:
                        print(f"Warning: Tag column index {idx} is out of bounds")
            else:
                # Assume tag_column contains actual column names
                for col in tag_cols:
                    if col in df_full.columns:
                        tag_col_names.append(col)
                    else:
                        print(f"Warning: Tag column '{col}' not found, skipping")
        
        print(f"Data columns: {df.columns.tolist()}")
        print(f"Tag columns: {tag_col_names}")
        
        # Convert NaN values to None (null in JSON)
        df = df.where(pd.notnull(df), None)
        df_full = df_full.where(pd.notnull(df_full), None)
        
        # Remove columns that contain only null values from data columns
        cols_to_drop = []
        for col in df.columns:
            if df[col].isna().all():
                print(f"Skipping column {col}")
                cols_to_drop.append(col)
        
        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)
        
        # Process data for the sheet
        sheet_data = []
        skipped_rows = 0
        sequential_id = 0  # Initialize sequential ID counter
        
        # Initialize tag tracking
        current_tags = {}  # Dictionary to store multiple tags
        
        for index, row in df.iterrows():
            # Get the corresponding row from the full DataFrame for tag detection
            full_row = df_full.iloc[index]
            
            # Convert row data to dictionary (only data columns)
            row_dict = row.to_dict()
            
            # Track if this is a header row
            is_header_row = False
            
            # Check each tag column for header rows
            for i, tag_col_name in enumerate(tag_col_names):
                # Get the value in the tag column
                tag_column_value = full_row.get(tag_col_name)
                
                # Check if this is a "header" row (tag column filled, others mostly empty)
                if tag_column_value is not None:
                    # Count non-null values outside tag columns
                    non_tag_values = sum(1 for k, v in full_row.items() 
                                        if k not in tag_col_names and v is not None)
                    
                    # If there are no (or very few) non-tag values, it's a header row
                    if non_tag_values <= 1:  # Allow at most 1 non-tag column to have a value
                        # This is a header/tag row, update the current tag for this column
                        
                        # Check if this is an "END" marker
                        if isinstance(tag_column_value, str) and tag_column_value.strip().upper() == "END":
                            # If "END" marker is found, clear the tag for this column
                            if i in current_tags:
                                del current_tags[i]
                            print(f"  Found END marker at row {index+1}, clearing tag for column {tag_col_name}")
                        else:
                            # Regular tag
                            current_tags[i] = tag_column_value
                        
                        is_header_row = True
            
            # Skip this row if it's a header row
            if is_header_row:
                continue
            
            # Check if all fields in data part are null
            all_null = all(v is None for v in row_dict.values())
            
            # Skip row if all fields are null
            if all_null:
                skipped_rows += 1
                continue
            
            # Add current tags if available
            for i, tag_value in current_tags.items():
                if i < len(tag_col_names):  # Safety check
                    # Use Tag_i format for multiple tags, or just Tag for single tag
                    if len(tag_col_names) == 1:
                        row_dict["Tag_0"] = tag_value
                    else:
                        row_dict[f"Tag_{i}"] = tag_value
            
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
    sheets = ["25用专业名词表"]
    header_row = 1
    id_field = "id"
    columns = ["A", "B", "C"]  # Specify the columns to include in the JSON output
    
    # Specify tag columns:
    # - For no tags: tag_column = []
    # - For single tag: tag_column = "A" or tag_column = ["A"]
    # - For multiple tags: tag_column = ["D", "E"] 
    tag_column = ["D"]
    
    # Execute conversion with consolidated option set to True
    excel_to_json(
        excel_file, 
        output, 
        prefix, 
        sheets, 
        header_row, 
        id_field,
        columns,
        consolidated=True,  # Generate a single consolidated JSON file
        tag_column=tag_column  # Columns to use for tag detection
    )

if __name__ == "__main__":
    main()