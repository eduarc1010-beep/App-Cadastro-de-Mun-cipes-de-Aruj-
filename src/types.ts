export interface Municipe {
  data?: string;
  nome: string;
  cpf: string;
  dataNasc: string;
  contato: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  moradores: string;
  adultos: string;
  interesse: string;
}

export interface User {
  username: string;
  nome: string;
  perfil: 'admin' | 'usuario';
}
