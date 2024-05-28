from openpyxl import load_workbook
import streamlit as st


def load_data_file(file_object, sheet_name):
    wb = load_workbook(file_object)
    ws = wb[sheet_name]
    headers, inputs = [], []
    for i, row in enumerate(ws): 
        if i == 0:
            headers = [cell.value for cell in row]
            continue
        inputs.append({headers[j]: cell.value for j, cell in enumerate(row)})
    return inputs


st.set_page_config(page_title="News Article Analysis")
st.sidebar.title("Upload input text")
uploaded_file = st.sidebar.file_uploader(
    "Choose a spreadsheet ...", type=["xlsx"]
)

submit = st.button("Fetch input")

if submit:
    if uploaded_file is not None:  # Add this check to ensure file is uploaded
        inputs = load_data_file(uploaded_file, 'Input')
        st.subheader("The inputs:")
        st.write(f"{inputs}")
    else:
        st.write("Please upload a spreadsheet first.")