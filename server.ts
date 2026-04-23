import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import { google } from "googleapis";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json());

  // Google Sheets Setup
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const range = "Dados!A:S";

  // Helper to extract clean error messages from Google API errors
  const getErrorMessage = (error: any): string => {
    let msg = error.message || "Erro desconhecido no servidor.";
    
    // Check for detailed Google API error message
    if (error.response?.data?.error?.message) {
      msg = error.response.data.error.message;
    }

    if (msg.includes("protected cell")) {
      return "Erro de Proteção: A planilha ou células específicas estão protegidas. Por favor, remova a proteção da aba 'Dados' ou permita que o e-mail da conta de serviço edite as células.";
    }
    
    if (msg.includes("API key not valid")) {
      return "Erro de Autenticação: A chave da API ou as credenciais da conta de serviço são inválidas.";
    }

    return msg;
  };

  // Middleware to validate Google Sheets configuration
  const validateConfig = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!spreadsheetId) {
      return res.status(400).json({ 
        error: "Configuração ausente: SPREADSHEET_ID não encontrado. Por favor, configure esta variável nos Secrets do AI Studio." 
      });
    }
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(400).json({ 
        error: "Configuração ausente: Credenciais do Google Cloud não encontradas. Verifique GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY nos Secrets." 
      });
    }
    next();
  };

  // Helper to ensure sheet exists and has headers
  async function ensureSheet() {
    if (!spreadsheetId) throw new Error("SPREADSHEET_ID is required");
    try {
      // Check if sheets exist
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const currentSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
      
      const sheetExists = currentSheets.includes("Dados");
      const usuariosSheetExists = currentSheets.includes("Usuarios");

      if (!sheetExists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "Dados" } } }]
          }
        });
      }

      if (!usuariosSheetExists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "Usuarios" } } }]
          }
        });
        
        // Initialize Usuarios headers and initial data
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Usuarios!A1:D1",
          valueInputOption: "RAW",
          requestBody: {
            values: [["USUÁRIO", "NOME", "PERFIL", "SENHA"]],
          },
        });

        // Add initial users from the static list in App.tsx
        const initialUsers = [
          ["eduardo", "Eduardo", "admin", "edu@2025"],
          ["beatriz", "Beatriz", "admin", "bea@2025"],
          ["gabriel", "Gabriel", "usuario", "gab@2025"],
          ["stefany", "Stefany", "usuario", "ste@2025"],
          ["samoel", "Samoel", "usuario", "sam@2025"]
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Usuarios!A2:D",
          valueInputOption: "RAW",
          requestBody: {
            values: initialUsers,
          },
        });
      }

      // Ensure Column P has no horizontal borders
      await cleanColumnPBorders();

      // Garantir cabeçalhos na ordem solicitada (A-S) para Dados
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Dados!A1:S1" });
      if (!response.data.values || response.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Dados!A1:S1",
          valueInputOption: "RAW",
          requestBody: {
            values: [[
              "DATA",              // A (0)
              "NOME",              // B (1)
              "CPF",               // C (2)
              "DATA NASC.",        // D (3)
              "CONTATO",           // E (4)
              "E-MAIL",            // F (5)
              "CEP",               // G (6)
              "LOGRADOURO",        // H (7)
              "NÚMERO",            // I (8)
              "BAIRRO",            // J (9)
              "CIDADE",            // K (10)
              "ESTADO",            // L (11)
              "Nº DE MORADORES",   // M (12)
              "QUANT. DE ADULTOS", // N (13)
              "INTERESSE",         // O (14)
              "",                  // P (15) - Espaçamento/Separação
              "USUÁRIO",           // Q (16) - Autor do registro
              "DATA R",            // R (17) - Data do registro (Brasília)
              "HORÁRIO"            // S (18) - Horário do registro (Brasília)
            ]],
          },
        });
      }
    } catch (err: any) {
      console.error("Error in ensureSheet:", err.message);
      // If it's a 404/403, it might be permissions or ID issues
      if (err.status === 404) throw new Error("Planilha não encontrada. Verifique o SPREADSHEET_ID.");
      if (err.status === 403) throw new Error("Acesso negado. Certifique-se de que a planilha foi compartilhada com o e-mail da conta de serviço.");
      throw err;
    }
  }

  // Helper to format date from yyyy-MM-dd to dd/MM/yyyy
  const formatToBR = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('-')) return dateStr;
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    return `${d}/${m}/${y}`;
  };

  // Helper to format date from dd/MM/yyyy to yyyy-MM-dd
  const formatToISO = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('/')) return dateStr;
    const [d, m, y] = dateStr.split('/');
    if (!d || !m || !y) return dateStr;
    return `${y}-${m}-${d}`;
  };

  let cachedSheetId: number | undefined;

  // Helper to get sheetId
  async function getSheetId() {
    if (cachedSheetId !== undefined) return cachedSheetId;
    if (!spreadsheetId) throw new Error("SPREADSHEET_ID is required");
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === "Dados");
    cachedSheetId = sheet?.properties?.sheetId;
    return cachedSheetId;
  }

  // Helper to synchronize all sheet formatting (All data rows border + Column P cleaning)
  async function syncSheetFormatting() {
    const sheetId = await getSheetId();
    if (sheetId === undefined) return;

    try {
      // 1. Get current data to know the number of rows
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Dados!A:S" });
      const values = response.data.values || [];
      const totalRows = values.length;

      if (totalRows === 0) return;

      const blueColor = { blue: 1.0, red: 0, green: 0 };
      const solidStyle = "SOLID";

      const requests: any[] = [
        // a) Clear ALL borders from A1:S to start fresh (in case of row deletions)
        {
          updateBorders: {
            range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 19 },
            top: { style: "NONE" },
            bottom: { style: "NONE" },
            left: { style: "NONE" },
            right: { style: "NONE" },
            innerHorizontal: { style: "NONE" },
            innerVertical: { style: "NONE" }
          }
        },
        // b) Apply Blue Borders to A:O (Columns 0 to 15) for ALL rows
        {
          updateBorders: {
            range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: 15 },
            top: { style: solidStyle, color: blueColor },
            bottom: { style: solidStyle, color: blueColor },
            left: { style: solidStyle, color: blueColor },
            right: { style: solidStyle, color: blueColor },
            innerHorizontal: { style: solidStyle, color: blueColor },
            innerVertical: { style: solidStyle, color: blueColor }
          }
        },
        // c) Apply lateral Blue Borders to P (Index 15) for ALL rows - NO top/bottom/horizontal
        {
          updateBorders: {
            range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 15, endColumnIndex: 16 },
            left: { style: solidStyle, color: blueColor },
            right: { style: solidStyle, color: blueColor },
            top: { style: "NONE" },
            bottom: { style: "NONE" },
            innerHorizontal: { style: "NONE" }
          }
        },
        // d) Apply Blue Borders to Q:S (Columns 16 to 19) for ALL rows
        {
          updateBorders: {
            range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 16, endColumnIndex: 19 },
            top: { style: solidStyle, color: blueColor },
            bottom: { style: solidStyle, color: blueColor },
            left: { style: solidStyle, color: blueColor },
            right: { style: solidStyle, color: blueColor },
            innerHorizontal: { style: solidStyle, color: blueColor },
            innerVertical: { style: solidStyle, color: blueColor }
          }
        }
      ];

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
    } catch (err) {
      console.error("Error in syncSheetFormatting:", err);
    }
  }

  // Helper to apply blue borders (Legacy, redirected to syncSheetFormatting)
  async function applyBlueBorders(startRow: number, endRow: number) {
    await syncSheetFormatting();
  }

  // Helper to ensure the last row always has the blue border (Legacy, redirected to syncSheetFormatting)
  async function ensureLastRowHasBorder() {
    await syncSheetFormatting();
  }

  // Helper to ensure column P (Index 15) has NO top/bottom borders across the sheet (Legacy, redirected to syncSheetFormatting)
  async function cleanColumnPBorders() {
    await syncSheetFormatting();
  }

  const getBrasiliaDateTime = () => {
    const now = new Date();
    const date = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const time = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return { date, time };
  };

  // API Routes
  app.post("/api/salvar", validateConfig, async (req, res) => {
    try {
      await ensureSheet();
      const dados = req.body;
      
      // Check for duplicate name
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Dados!B:B" });
      const names = response.data.values || [];
      const exists = names.some(row => row[0]?.toString().trim().toUpperCase() === dados.nome.trim().toUpperCase());
      
      if (exists) {
        return res.json({ status: "NOME_REPETIDO" });
      }

      const { date: dataFinal, time: horarioFinal } = getBrasiliaDateTime();

      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values: [[
            dataFinal,             // A: Data (Formulário)
            dados.nome,            // B: Nome
            dados.cpf,             // C: CPF
            formatToBR(dados.dataNasc), // D: Data Nasc (padrão brasileiro dd/MM/aaaa)
            dados.contato,         // E: Contato
            dados.email,           // F: E-mail
            dados.cep,             // G: CEP
            dados.logradouro,      // H: Logradouro
            dados.numero,          // I: Número
            dados.bairro,          // J: Bairro
            dados.cidade,          // K: Cidade
            dados.estado,          // L: Estado
            dados.moradores,       // M: Moradores
            dados.adultos,         // N: Adultos
            dados.interesse,       // O: Interesse
            "",                    // P: Espaço em branco solicitado
            dados.usuarioResponsavel || "", // Q: Nome do usuário
            dataFinal,             // R: Data do Registro (Brasília)
            horarioFinal           // S: Horário do Registro (Brasília)
          ]],
        },
      });

      // Apply blue borders to the new row
      const updatedRange = appendResponse.data.updates?.updatedRange;
      if (updatedRange) {
        const match = updatedRange.match(/!A(\d+):S(\d+)/);
        if (match) {
          const start = parseInt(match[1]) - 1;
          const end = parseInt(match[2]);
          await applyBlueBorders(start, end);
        }
      }

      // Explicitly ensure the last row has the blue border (redundant but requested policy)
      await ensureLastRowHasBorder();

      // Ensure Column P horizontal borders are removed
      await cleanColumnPBorders();

      res.json({ status: "SALVO" });
    } catch (error: any) {
      console.error("Error saving:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  app.get("/api/pesquisar", validateConfig, async (req, res) => {
    try {
      await ensureSheet();
      const { nome } = req.query;
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = response.data.values || [];
      
      const searchName = (nome as string).trim().toUpperCase();
      const found = rows.find(row => row[1]?.toString().trim().toUpperCase() === searchName);

      if (found) {
        // Convert date back to ISO for the frontend date picker
        const formattedData = [...found];
        formattedData[3] = formatToISO(formattedData[3]);
        res.json({ data: formattedData });
      } else {
        res.json({ data: null });
      }
    } catch (error: any) {
      console.error("Error searching:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  app.post("/api/editar", validateConfig, async (req, res) => {
    try {
      await ensureSheet();
      const dados = req.body;
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = response.data.values || [];
      
      const nomeOriginal = (dados.nomeOriginal || dados.nome).toString().trim().toUpperCase();
      const rowIndex = rows.findIndex(row => row[1]?.toString().trim().toUpperCase() === nomeOriginal);

      if (rowIndex === -1) {
        return res.json({ status: "NAO_ENCONTRADO" });
      }

      const { date: dataFinal, time: horarioFinal } = getBrasiliaDateTime();

      const dataOriginal = rows[rowIndex][0];
      const updateRange = `Dados!A${rowIndex + 1}:S${rowIndex + 1}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: updateRange,
        valueInputOption: "RAW",
        requestBody: {
          values: [[
            dataOriginal,          // A: Data Original
            dados.nome,            // B: Nome
            dados.cpf,             // C: CPF
            formatToBR(dados.dataNasc), // D: Data Nasc
            dados.contato,         // E: Contato
            dados.email,           // F: E-mail
            dados.cep,             // G: CEP
            dados.logradouro,      // H: Logradouro
            dados.numero,          // I: Número
            dados.bairro,          // J: Bairro
            dados.cidade,          // K: Cidade
            dados.estado,          // L: Estado
            dados.moradores,       // M: Moradores
            dados.adultos,         // N: Adultos
            dados.interesse,       // O: Interesse
            "",                    // P: Espaço em branco
            dados.usuarioResponsavel || rows[rowIndex][16] || "", // Q
            dataFinal,             // R
            horarioFinal           // S
          ]],
        },
      });

      // Apply blue borders to the updated row
      await applyBlueBorders(rowIndex, rowIndex + 1);
      
      // Ensure the last row also has the blue border
      await ensureLastRowHasBorder();

      // Ensure Column P horizontal borders are removed
      await cleanColumnPBorders();

      res.json({ status: "EDITADO" });
    } catch (error: any) {
      console.error("Error editing:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  app.post("/api/excluir", validateConfig, async (req, res) => {
    try {
      await ensureSheet();
      const { nome } = req.body;
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = response.data.values || [];
      
      const searchName = nome.toString().trim().toUpperCase();
      const rowIndex = rows.findIndex(row => row[1]?.toString().trim().toUpperCase() === searchName);

      if (rowIndex === -1) {
        return res.json({ status: "NAO_ENCONTRADO" });
      }

      // To delete a row, we need the sheetId
      const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = sheetInfo.data.sheets?.find(s => s.properties?.title === "Dados");
      const sheetId = sheet?.properties?.sheetId;

      if (sheetId === undefined) {
        throw new Error("Página 'Dados' não encontrada na planilha.");
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }]
        }
      });

      // Ensure the last row has the blue border after deletion
      await ensureLastRowHasBorder();

      // Ensure Column P horizontal borders are removed
      await cleanColumnPBorders();

      res.json({ status: "EXCLUIDO" });
    } catch (error: any) {
      console.error("Error deleting:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  app.post("/api/login", validateConfig, async (req, res) => {
    try {
      await ensureSheet();
      const { username, password } = req.body;
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Usuarios!A:D" });
      const rows = response.data.values || [];
      
      // Skip header
      const userFound = rows.slice(1).find(row => 
        row[0]?.toString().trim().toLowerCase() === username.trim().toLowerCase() && 
        row[3]?.toString().trim() === password.toString().trim()
      );

      if (userFound) {
        res.json({ 
          success: true,
          user: {
            username: userFound[0],
            nome: userFound[1],
            perfil: userFound[2]
          }
        });
      } else {
        res.json({ success: false });
      }
    } catch (error: any) {
      console.error("Error in login:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  app.get("/api/usuarios", validateConfig, async (req, res) => {
    try {
      await ensureSheet();
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Usuarios!A:D" });
      const rows = response.data.values || [];
      // Skip header
      const users = rows.slice(1).map(row => ({
        username: row[0],
        nome: row[1],
        perfil: row[2],
        senha: row[3]
      }));
      res.json({ users });
    } catch (error: any) {
      console.error("Error getting users:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  app.post("/api/usuarios/update-password", validateConfig, async (req, res) => {
    try {
      await ensureSheet();
      const { username, newPassword } = req.body;
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Usuarios!A:A" });
      const rows = response.data.values || [];
      
      const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === username.trim());
      if (rowIndex === -1) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      // Update password column (D)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Usuarios!D${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[newPassword]],
        },
      });

      res.json({ status: "OK" });
    } catch (error: any) {
      console.error("Error updating password:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
