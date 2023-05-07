import React, { useState, useRef } from 'react';
import readXlsxFile from 'read-excel-file'
import { Row, Col, Button, Form } from 'react-bootstrap';
import parseXlsxToAIDataSource from './parser';
import './App.css';

function App() {
  const [file, setFile] = useState<File>();
  const [basePhotoPath, setBasePhotoPath] = useState<string>('');
  const [photoDirectory, setPhotoDirectory] = useState<FileSystemDirectoryHandle>();
  const [silhouettePhotoPath, setSilhouettePhotoPath] = useState<string>('');
  const [notFoundPlaceholderPath, setNotFoundPlaceholderPath] = useState<string>('');
  const [csv, setCSV] = useState<string>('');
  const downloadRef = useRef<HTMLAnchorElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (file && photoDirectory) {
      readXlsxFile(file).then(async (rows) => {
        const directoryEntries: string[] = [];
        for await(const entry of photoDirectory.entries()) {
          directoryEntries.push(entry[0]);
        }

        const parsedToCSVArray = parseXlsxToAIDataSource(rows, basePhotoPath, silhouettePhotoPath, notFoundPlaceholderPath, directoryEntries);
        const parsedToCSV = parsedToCSVArray.map(row => row.map(item => `"${item}"`).join(',')).join('\n');
        setCSV(parsedToCSV);
        downloadRef.current?.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(parsedToCSV)}`);
        downloadRef.current?.click();
        console.log(parsedToCSVArray);
      });
    }
  }

  const handleChangeBasePhotoPath = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBasePhotoPath(e.target.value);
    const defaultSilhouettePhotoPath = `${e.target.value}/SILHOUETTE.png`;
    const defaultNotFoundPlaceholderPath = `${e.target.value}/NOT_FOUND.png`;
    setSilhouettePhotoPath(defaultSilhouettePhotoPath);
    setNotFoundPlaceholderPath(defaultNotFoundPlaceholderPath);
  }

  const handleSelectPhotoDirectory = async () => {
    const handle = await window.showDirectoryPicker();
    setPhotoDirectory(handle);
  }

  return (
    <div className="App">
      <h1>
        SparkDesign Excel to CSV Data Source Converter
      </h1>
      <Row>
        <Col>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="basePhotoPath">
              <Form.Label>Base Photo Path:</Form.Label>
              <Form.Control
                name="basePhotoPath"
                type="text"
                placeholder="Enter base photo path"
                value={basePhotoPath}
                required
                onChange={handleChangeBasePhotoPath}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="silhouettePhotoPath">
              <Form.Label>Silhouette Photo Path (Optional):</Form.Label>
              <Form.Control
                name="silhouettePhotoPath"
                type="text"
                placeholder="Enter silhouette photo path (SILHOUETTE.png)"
                value={silhouettePhotoPath}
                required
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSilhouettePhotoPath(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="notFoundPlaceholderPath">
              <Form.Label>Placeholder Photo Path (Optional):</Form.Label>
              <Form.Control
                name="notFoundPlaceholderPath"
                type="text"
                placeholder="Enter placeholder photo path if the photo is not found (NOT_FOUND.png)"
                value={notFoundPlaceholderPath}
                required
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotFoundPlaceholderPath(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="photoDirectory">
              <Form.Label>Photo Directory (Choose the same directory as Base Photo Path):</Form.Label>
              <Button
                type="button"
                variant="info"
                onClick={handleSelectPhotoDirectory}
              >
                {photoDirectory ? `Selected: ${photoDirectory.name}` : 'Select Photo Directory'}
              </Button>
            </Form.Group>
            <Form.Group controlId="excelFile" className="mb-3">
              <Form.Label>Excel File:</Form.Label>
              <Form.Control
                name="excelFile"
                type="file"
                accept=".xlsx"
                required
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0])}
              />
            </Form.Group>
            <Button variant="primary" type="submit">
              Convert and Download CSV
            </Button>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
              download="data-source.csv"
              style={{ display: 'none' }}
              ref={downloadRef}
            >
              Download
            </a>
          </Form>
        </Col>
      </Row>
    </div>
  );
}

export default App;
