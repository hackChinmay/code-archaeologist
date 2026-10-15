import type { Repository, RepoFile, SymbolItem, Dependency, CodeChunk } from '../../src/types/index.ts';

export interface SeedRepoData {
  repo: Repository;
  files: RepoFile[];
  symbols: SymbolItem[];
  dependencies: Dependency[];
  chunks: CodeChunk[];
}

export const SAMPLE_REPOSITORIES: Record<string, SeedRepoData> = {
  'repo-python-fastapi': {
    repo: {
      id: 'repo-python-fastapi',
      name: 'fastapi-jwt-auth-service',
      owner: 'repomind',
      url: 'https://github.com/repomind/fastapi-jwt-auth-service',
      defaultBranch: 'main',
      description: 'Production-ready FastAPI authentication and user authorization microservice featuring JWT, OAuth2 scopes, SQLAlchemy ORM, and bcrypt password hashing.',
      status: 'COMPLETED',
      progress: 100,
      statusMessage: 'Analysis completed. 8 files parsed, 19 symbols extracted, 24 chunks indexed.',
      createdAt: '2026-09-20T14:30:00Z',
      updatedAt: '2026-09-24T10:00:00Z',
      stats: {
        filesCount: 8,
        dirsCount: 4,
        classesCount: 6,
        functionsCount: 13,
        dependenciesCount: 18,
        linesOfCode: 485,
        chunksCount: 24,
        languages: [
          { name: 'Python', percentage: 92.5, filesCount: 7, color: '#3572A5' },
          { name: 'SQL', percentage: 7.5, filesCount: 1, color: '#e38c00' },
        ],
      },
      summary: 'This repository implements a modular authentication microservice using FastAPI, SQLAlchemy, and Pydantic. It provides secure user registration, bcrypt password hashing, JWT token issuance with refresh rotation, and role-based access control (RBAC) via FastAPI dependencies.',
      architectureSummary: 'Layered architecture: Presentation layer (routers/auth.py, routers/users.py) delegates to Business Logic / Security layer (security/tokens.py, security/passwords.py), which interfaces with Data Access layer (models/user.py, database/session.py). Configuration is centralized in core/config.py.',
    },
    files: [
      {
        id: 'f-py-1',
        repositoryId: 'repo-python-fastapi',
        path: 'app/main.py',
        name: 'main.py',
        language: 'Python',
        size: 1420,
        linesCount: 45,
        symbolsCount: 3,
        imports: ['fastapi', 'app.core.config', 'app.routers.auth', 'app.routers.users', 'app.database.session'],
        classes: [],
        functions: ['create_application', 'lifespan'],
        content: `"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.database.session import init_db
from app.routers import auth, users

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    yield

def create_application() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
    application.include_router(users.router, prefix="/api/v1/users", tags=["users"])

    @application.get("/health")
    async def health_check():
        return {"status": "healthy", "service": "auth-service"}

    return application

app = create_application()
`,
      },
      {
        id: 'f-py-2',
        repositoryId: 'repo-python-fastapi',
        path: 'app/core/config.py',
        name: 'config.py',
        language: 'Python',
        size: 1100,
        linesCount: 32,
        symbolsCount: 2,
        imports: ['pydantic_settings', 'functools'],
        classes: ['Settings'],
        functions: ['get_settings'],
        content: `"""Application settings and environment configuration."""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Auth Microservice"
    VERSION: str = "1.0.0"
    SECRET_KEY: str = "insecure-dev-secret-key-change-in-prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DATABASE_URL: str = "sqlite+aiosqlite:///./auth.db"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
`,
      },
      {
        id: 'f-py-3',
        repositoryId: 'repo-python-fastapi',
        path: 'app/database/session.py',
        name: 'session.py',
        language: 'Python',
        size: 1350,
        linesCount: 38,
        symbolsCount: 3,
        imports: ['sqlalchemy.ext.asyncio', 'app.core.config'],
        classes: ['Base'],
        functions: ['init_db', 'get_db_session'],
        content: `"""Asynchronous database session management with SQLAlchemy."""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

async def init_db() -> None:
    """Create tables if they do not exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection yield for database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
`,
      },
      {
        id: 'f-py-4',
        repositoryId: 'repo-python-fastapi',
        path: 'app/models/user.py',
        name: 'user.py',
        language: 'Python',
        size: 1220,
        linesCount: 36,
        symbolsCount: 2,
        imports: ['sqlalchemy', 'app.database.session'],
        classes: ['User', 'RoleEnum'],
        functions: [],
        content: `"""User SQLAlchemy ORM entity and Role definitions."""
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from app.database.session import Base

class RoleEnum(str, enum.Enum):
    ADMIN = "admin"
    DEVELOPER = "developer"
    VIEWER = "viewer"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(RoleEnum), default=RoleEnum.DEVELOPER)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
`,
      },
      {
        id: 'f-py-5',
        repositoryId: 'repo-python-fastapi',
        path: 'app/security/passwords.py',
        name: 'passwords.py',
        language: 'Python',
        size: 980,
        linesCount: 28,
        symbolsCount: 2,
        imports: ['passlib.context'],
        classes: [],
        functions: ['verify_password', 'get_password_hash'],
        content: `"""Password hashing and verification utilities using passlib bcrypt."""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify raw password against bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)
`,
      },
      {
        id: 'f-py-6',
        repositoryId: 'repo-python-fastapi',
        path: 'app/security/tokens.py',
        name: 'tokens.py',
        language: 'Python',
        size: 2100,
        linesCount: 56,
        symbolsCount: 3,
        imports: ['jwt', 'datetime', 'app.core.config'],
        classes: [],
        functions: ['create_access_token', 'create_refresh_token', 'decode_token'],
        content: `"""JSON Web Token (JWT) generation and verification."""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import jwt, JWTError

from app.core.config import get_settings

settings = get_settings()

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token with expiration timestamp."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: Dict[str, Any]) -> str:
    """Generate signed JWT refresh token with longer validity."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": now, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate token signature."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as err:
        raise ValueError(f"Invalid or expired JWT token: {str(err)}")
`,
      },
      {
        id: 'f-py-7',
        repositoryId: 'repo-python-fastapi',
        path: 'app/routers/auth.py',
        name: 'auth.py',
        language: 'Python',
        size: 2850,
        linesCount: 78,
        symbolsCount: 4,
        imports: ['fastapi', 'sqlalchemy', 'app.database.session', 'app.models.user', 'app.security.tokens', 'app.security.passwords'],
        classes: [],
        functions: ['register_user', 'login_for_access_token', 'refresh_access_token', 'authenticate_user'],
        content: `"""Authentication API routes: registration, login, and token refresh."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.session import get_db_session
from app.models.user import User
from app.security.passwords import verify_password, get_password_hash
from app.security.tokens import create_access_token, create_refresh_token, decode_token

router = APIRouter()

async def authenticate_user(db: AsyncSession, username: str, password: str) -> User:
    """Validate user credentials against database records."""
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return user

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(payload: dict, db: AsyncSession = Depends(get_db_session)):
    """Register new user with hashed password."""
    stmt = select(User).where((User.email == payload["email"]) | (User.username == payload["username"]))
    existing = await db.execute(stmt)
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Username or email already exists")

    new_user = User(
        email=payload["email"],
        username=payload["username"],
        hashed_password=get_password_hash(payload["password"]),
    )
    db.add(new_user)
    await db.flush()
    return {"message": "User registered successfully", "user_id": new_user.id}

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db_session)):
    """OAuth2 password flow token endpoint."""
    user = await authenticate_user(db, form_data.username, form_data.password)
    access_token = create_access_token(data={"sub": user.username, "role": user.role.value})
    refresh_token = create_refresh_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }
`,
      },
      {
        id: 'f-py-8',
        repositoryId: 'repo-python-fastapi',
        path: 'app/routers/users.py',
        name: 'users.py',
        language: 'Python',
        size: 1600,
        linesCount: 42,
        symbolsCount: 2,
        imports: ['fastapi', 'app.database.session', 'app.models.user', 'app.security.tokens'],
        classes: [],
        functions: ['get_current_user', 'read_current_user_profile'],
        content: `"""User profile and RBAC endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.session import get_db_session
from app.models.user import User
from app.security.tokens import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
router = APIRouter()

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db_session)) -> User:
    """Dependency that extracts user from JWT Bearer token."""
    try:
        payload = decode_token(token)
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

@router.get("/me")
async def read_current_user_profile(current_user: User = Depends(get_current_user)):
    """Return authenticated user profile."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }
`,
      },
    ],
    symbols: [
      {
        id: 'sym-1',
        fileId: 'f-py-1',
        filePath: 'app/main.py',
        name: 'lifespan',
        type: 'function',
        startLine: 9,
        endLine: 13,
        signature: 'async def lifespan(app: FastAPI)',
        docstring: 'Initialize database tables on startup.',
        detectedFrom: 'Tree-sitter AST',
        calls: ['init_db'],
      },
      {
        id: 'sym-2',
        fileId: 'f-py-1',
        filePath: 'app/main.py',
        name: 'create_application',
        type: 'function',
        startLine: 15,
        endLine: 43,
        signature: 'def create_application() -> FastAPI',
        docstring: 'Instantiate and configure FastAPI application with CORS and routers.',
        detectedFrom: 'Tree-sitter AST',
        calls: ['get_settings', 'add_middleware', 'include_router'],
      },
      {
        id: 'sym-3',
        fileId: 'f-py-2',
        filePath: 'app/core/config.py',
        name: 'Settings',
        type: 'class',
        startLine: 6,
        endLine: 24,
        signature: 'class Settings(BaseSettings)',
        docstring: 'Application settings and environment configuration with pydantic-settings.',
        detectedFrom: 'Tree-sitter AST',
        inherits: ['BaseSettings'],
      },
      {
        id: 'sym-4',
        fileId: 'f-py-2',
        filePath: 'app/core/config.py',
        name: 'get_settings',
        type: 'function',
        startLine: 26,
        endLine: 29,
        signature: 'def get_settings() -> Settings',
        docstring: 'Return cached application settings singleton.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-5',
        fileId: 'f-py-3',
        filePath: 'app/database/session.py',
        name: 'Base',
        type: 'class',
        startLine: 24,
        endLine: 24,
        signature: 'Base = declarative_base()',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-6',
        fileId: 'f-py-3',
        filePath: 'app/database/session.py',
        name: 'init_db',
        type: 'function',
        startLine: 26,
        endLine: 29,
        signature: 'async def init_db() -> None',
        docstring: 'Create tables if they do not exist.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-7',
        fileId: 'f-py-3',
        filePath: 'app/database/session.py',
        name: 'get_db_session',
        type: 'function',
        startLine: 31,
        endLine: 38,
        signature: 'async def get_db_session() -> AsyncGenerator[AsyncSession, None]',
        docstring: 'Dependency injection yield for database session per request.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-8',
        fileId: 'f-py-4',
        filePath: 'app/models/user.py',
        name: 'RoleEnum',
        type: 'class',
        startLine: 7,
        endLine: 10,
        signature: 'class RoleEnum(str, enum.Enum)',
        detectedFrom: 'Tree-sitter AST',
        inherits: ['str', 'Enum'],
      },
      {
        id: 'sym-9',
        fileId: 'f-py-4',
        filePath: 'app/models/user.py',
        name: 'User',
        type: 'class',
        startLine: 12,
        endLine: 24,
        signature: 'class User(Base)',
        docstring: 'User SQLAlchemy ORM entity with id, email, username, and role.',
        detectedFrom: 'Tree-sitter AST',
        inherits: ['Base'],
      },
      {
        id: 'sym-10',
        fileId: 'f-py-5',
        filePath: 'app/security/passwords.py',
        name: 'verify_password',
        type: 'function',
        startLine: 6,
        endLine: 8,
        signature: 'def verify_password(plain_password: str, hashed_password: str) -> bool',
        docstring: 'Verify raw password against bcrypt hash.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-11',
        fileId: 'f-py-5',
        filePath: 'app/security/passwords.py',
        name: 'get_password_hash',
        type: 'function',
        startLine: 10,
        endLine: 12,
        signature: 'def get_password_hash(password: str) -> str',
        docstring: 'Hash password using bcrypt.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-12',
        fileId: 'f-py-6',
        filePath: 'app/security/tokens.py',
        name: 'create_access_token',
        type: 'function',
        startLine: 10,
        endLine: 19,
        signature: 'def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str',
        docstring: 'Generate signed JWT access token with expiration timestamp.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-13',
        fileId: 'f-py-6',
        filePath: 'app/security/tokens.py',
        name: 'create_refresh_token',
        type: 'function',
        startLine: 21,
        endLine: 27,
        signature: 'def create_refresh_token(data: Dict[str, Any]) -> str',
        docstring: 'Generate signed JWT refresh token with longer validity.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-14',
        fileId: 'f-py-6',
        filePath: 'app/security/tokens.py',
        name: 'decode_token',
        type: 'function',
        startLine: 29,
        endLine: 36,
        signature: 'def decode_token(token: str) -> Dict[str, Any]',
        docstring: 'Decode and validate token signature.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-15',
        fileId: 'f-py-7',
        filePath: 'app/routers/auth.py',
        name: 'authenticate_user',
        type: 'function',
        startLine: 14,
        endLine: 26,
        signature: 'async def authenticate_user(db: AsyncSession, username: str, password: str) -> User',
        docstring: 'Validate user credentials against database records.',
        detectedFrom: 'Tree-sitter AST',
        calls: ['verify_password'],
      },
      {
        id: 'sym-16',
        fileId: 'f-py-7',
        filePath: 'app/routers/auth.py',
        name: 'register_user',
        type: 'function',
        startLine: 28,
        endLine: 43,
        signature: 'async def register_user(payload: dict, db: AsyncSession = Depends(get_db_session))',
        docstring: 'Register new user with hashed password.',
        detectedFrom: 'Tree-sitter AST',
        calls: ['get_password_hash'],
      },
      {
        id: 'sym-17',
        fileId: 'f-py-7',
        filePath: 'app/routers/auth.py',
        name: 'login_for_access_token',
        type: 'function',
        startLine: 45,
        endLine: 54,
        signature: 'async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db_session))',
        docstring: 'OAuth2 password flow token endpoint.',
        detectedFrom: 'Tree-sitter AST',
        calls: ['authenticate_user', 'create_access_token', 'create_refresh_token'],
      },
      {
        id: 'sym-18',
        fileId: 'f-py-8',
        filePath: 'app/routers/users.py',
        name: 'get_current_user',
        type: 'function',
        startLine: 13,
        endLine: 28,
        signature: 'async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db_session)) -> User',
        docstring: 'Dependency that extracts user from JWT Bearer token.',
        detectedFrom: 'Tree-sitter AST',
        calls: ['decode_token'],
      },
      {
        id: 'sym-19',
        fileId: 'f-py-8',
        filePath: 'app/routers/users.py',
        name: 'read_current_user_profile',
        type: 'function',
        startLine: 30,
        endLine: 40,
        signature: 'async def read_current_user_profile(current_user: User = Depends(get_current_user))',
        docstring: 'Return authenticated user profile.',
        detectedFrom: 'Tree-sitter AST',
      },
    ],
    dependencies: [
      { id: 'dep-1', source: 'app/main.py', target: 'app/core/config.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-2', source: 'app/main.py', target: 'app/database/session.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-3', source: 'app/main.py', target: 'app/routers/auth.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-4', source: 'app/main.py', target: 'app/routers/users.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-5', source: 'app/database/session.py', target: 'app/core/config.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-6', source: 'app/models/user.py', target: 'app/database/session.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-7', source: 'app/models/user.py', target: 'Base', relationshipType: 'inherits', category: 'internal' },
      { id: 'dep-8', source: 'app/security/tokens.py', target: 'app/core/config.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-9', source: 'app/routers/auth.py', target: 'app/database/session.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-10', source: 'app/routers/auth.py', target: 'app/models/user.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-11', source: 'app/routers/auth.py', target: 'app/security/passwords.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-12', source: 'app/routers/auth.py', target: 'app/security/tokens.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-13', source: 'app/routers/users.py', target: 'app/models/user.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-14', source: 'app/routers/users.py', target: 'app/security/tokens.py', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-15', source: 'app/main.py', target: 'fastapi', relationshipType: 'depends_on', category: 'external' },
      { id: 'dep-16', source: 'app/database/session.py', target: 'sqlalchemy', relationshipType: 'depends_on', category: 'external' },
      { id: 'dep-17', source: 'app/security/passwords.py', target: 'passlib', relationshipType: 'depends_on', category: 'external' },
      { id: 'dep-18', source: 'app/security/tokens.py', target: 'jose', relationshipType: 'depends_on', category: 'external' },
    ],
    chunks: [
      {
        id: 'chk-1',
        repositoryId: 'repo-python-fastapi',
        filePath: 'app/routers/auth.py',
        language: 'Python',
        symbolType: 'function',
        symbolName: 'authenticate_user',
        startLine: 14,
        endLine: 26,
        content: `async def authenticate_user(db: AsyncSession, username: str, password: str) -> User:
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return user`,
      },
      {
        id: 'chk-2',
        repositoryId: 'repo-python-fastapi',
        filePath: 'app/routers/auth.py',
        language: 'Python',
        symbolType: 'function',
        symbolName: 'login_for_access_token',
        startLine: 45,
        endLine: 54,
        content: `@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db_session)):
    user = await authenticate_user(db, form_data.username, form_data.password)
    access_token = create_access_token(data={"sub": user.username, "role": user.role.value})
    refresh_token = create_refresh_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }`,
      },
      {
        id: 'chk-3',
        repositoryId: 'repo-python-fastapi',
        filePath: 'app/security/tokens.py',
        language: 'Python',
        symbolType: 'function',
        symbolName: 'create_access_token',
        startLine: 10,
        endLine: 19,
        content: `def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt`,
      },
      {
        id: 'chk-4',
        repositoryId: 'repo-python-fastapi',
        filePath: 'app/database/session.py',
        language: 'Python',
        symbolType: 'function',
        symbolName: 'get_db_session',
        startLine: 31,
        endLine: 38,
        content: `async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise`,
      },
      {
        id: 'chk-5',
        repositoryId: 'repo-python-fastapi',
        filePath: 'app/models/user.py',
        language: 'Python',
        symbolType: 'class',
        symbolName: 'User',
        startLine: 12,
        endLine: 24,
        content: `class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(RoleEnum), default=RoleEnum.DEVELOPER)`,
      },
      {
        id: 'chk-6',
        repositoryId: 'repo-python-fastapi',
        filePath: 'app/security/passwords.py',
        language: 'Python',
        symbolType: 'function',
        symbolName: 'verify_password',
        startLine: 6,
        endLine: 8,
        content: `def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)`,
      },
      {
        id: 'chk-7',
        repositoryId: 'repo-python-fastapi',
        filePath: 'app/routers/users.py',
        language: 'Python',
        symbolType: 'function',
        symbolName: 'get_current_user',
        startLine: 13,
        endLine: 28,
        content: `async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db_session)) -> User:
    payload = decode_token(token)
    username = payload.get("sub")
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalars().first()
    return user`,
      },
      {
        id: 'chk-8',
        repositoryId: 'repo-python-fastapi',
        filePath: 'app/main.py',
        language: 'Python',
        symbolType: 'function',
        symbolName: 'create_application',
        startLine: 15,
        endLine: 43,
        content: `def create_application() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title=settings.PROJECT_NAME)
    application.include_router(auth.router, prefix="/api/v1/auth")
    application.include_router(users.router, prefix="/api/v1/users")
    return application`,
      },
    ],
  },
  'repo-ts-code-archaeologist': {
    repo: {
      id: 'repo-ts-code-archaeologist',
      name: 'repomind-core-engine',
      owner: 'repomind',
      url: 'https://github.com/repomind/repomind-core-engine',
      defaultBranch: 'main',
      description: 'Core TypeScript engine for AST parsing, code chunking, ChromaDB vector indexing, and Gemini-powered retrieval augmented generation.',
      status: 'COMPLETED',
      progress: 100,
      statusMessage: 'Analysis completed. 6 files parsed, 18 symbols extracted, 22 chunks indexed.',
      createdAt: '2026-09-22T09:15:00Z',
      updatedAt: '2026-09-24T10:10:00Z',
      stats: {
        filesCount: 6,
        dirsCount: 3,
        classesCount: 5,
        functionsCount: 12,
        dependenciesCount: 15,
        linesOfCode: 520,
        chunksCount: 22,
        languages: [
          { name: 'TypeScript', percentage: 95.0, filesCount: 5, color: '#3178c6' },
          { name: 'JSON', percentage: 5.0, filesCount: 1, color: '#292929' },
        ],
      },
      summary: 'High-performance TypeScript AST analysis and semantic code retrieval pipeline. It integrates Tree-sitter language grammars, semantic code chunking, vector indexing in ChromaDB, and context-assembled Gemini RAG for grounded repository exploration.',
      architectureSummary: 'Pipelined architecture: ASTParser and StaticAnalyzer parse source code into symbols and call graphs. CodeChunker slices semantic boundaries, VectorStore generates embeddings into ChromaDB, and RAGOrchestrator injects retrieved context into Google Gemini for grounded Q&A.',
    },
    files: [
      {
        id: 'f-ts-1',
        repositoryId: 'repo-ts-code-archaeologist',
        path: 'src/analyzers/ast-parser.ts',
        name: 'ast-parser.ts',
        language: 'TypeScript',
        size: 2400,
        linesCount: 68,
        symbolsCount: 4,
        imports: ['web-tree-sitter', '../types'],
        classes: ['ASTParser'],
        functions: ['parseSourceFile', 'extractSymbols', 'traverseAST'],
        content: `import Parser from 'web-tree-sitter';
import { SymbolItem, SourceLocation } from '../types';

export class ASTParser {
  private parser: Parser | null = null;
  private language: string;

  constructor(language: string) {
    this.language = language;
  }

  public async initialize(): Promise<void> {
    await Parser.init();
    this.parser = new Parser();
  }

  public parseSourceFile(code: string, filePath: string): SymbolItem[] {
    if (!this.parser) {
      throw new Error('Parser not initialized. Call initialize() first.');
    }
    const tree = this.parser.parse(code);
    return this.extractSymbols(tree.rootNode, filePath);
  }

  private extractSymbols(rootNode: Parser.SyntaxNode, filePath: string): SymbolItem[] {
    const symbols: SymbolItem[] = [];
    this.traverseAST(rootNode, (node) => {
      if (node.type === 'class_declaration' || node.type === 'class') {
        symbols.push({
          id: \`\${filePath}-\${node.startPosition.row}\`,
          name: node.childForFieldName('name')?.text || 'AnonymousClass',
          type: 'class',
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          filePath,
        });
      } else if (node.type === 'function_declaration' || node.type === 'method_definition') {
        symbols.push({
          id: \`\${filePath}-\${node.startPosition.row}\`,
          name: node.childForFieldName('name')?.text || 'anonymousFunction',
          type: node.type === 'method_definition' ? 'method' : 'function',
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          filePath,
        });
      }
    });
    return symbols;
  }

  private traverseAST(node: Parser.SyntaxNode, callback: (n: Parser.SyntaxNode) => void): void {
    callback(node);
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) this.traverseAST(child, callback);
    }
  }
}
`,
      },
      {
        id: 'f-ts-2',
        repositoryId: 'repo-ts-code-archaeologist',
        path: 'src/analyzers/chunker.ts',
        name: 'chunker.ts',
        language: 'TypeScript',
        size: 1950,
        linesCount: 52,
        symbolsCount: 3,
        imports: ['../types'],
        classes: ['SemanticChunker'],
        functions: ['chunkFile', 'createChunk'],
        content: `import { SymbolItem, CodeChunk } from '../types';

export class SemanticChunker {
  private maxChunkLines: number;

  constructor(maxChunkLines: number = 80) {
    this.maxChunkLines = maxChunkLines;
  }

  public chunkFile(filePath: string, content: string, symbols: SymbolItem[], language: string): CodeChunk[] {
    const lines = content.split('\\n');
    const chunks: CodeChunk[] = [];

    // Chunk based on AST symbols first
    for (const sym of symbols) {
      if (sym.type === 'class' || sym.type === 'function') {
        const symbolLines = lines.slice(sym.startLine - 1, sym.endLine);
        chunks.push({
          id: \`chk-\${filePath}-\${sym.name}-\${sym.startLine}\`,
          repositoryId: 'repo-ts-code-archaeologist',
          filePath,
          language,
          symbolType: sym.type,
          symbolName: sym.name,
          startLine: sym.startLine,
          endLine: sym.endLine,
          content: symbolLines.join('\\n'),
        });
      }
    }
    return chunks;
  }
}
`,
      },
      {
        id: 'f-ts-3',
        repositoryId: 'repo-ts-code-archaeologist',
        path: 'src/rag/vector-store.ts',
        name: 'vector-store.ts',
        language: 'TypeScript',
        size: 2800,
        linesCount: 75,
        symbolsCount: 4,
        imports: ['chromadb', '../types'],
        classes: ['ChromaVectorStore'],
        functions: ['createCollection', 'addChunks', 'similaritySearch'],
        content: `import { ChromaClient, Collection } from 'chromadb';
import { CodeChunk, SearchResult } from '../types';

export class ChromaVectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor(host: string = 'http://localhost:8000') {
    this.client = new ChromaClient({ path: host });
  }

  public async createCollection(repositoryId: string): Promise<void> {
    this.collection = await this.client.getOrCreateCollection({
      name: \`repo_\${repositoryId.replace(/[^a-zA-Z0-9]/g, '_')}\`,
      metadata: { repositoryId },
    });
  }

  public async addChunks(chunks: CodeChunk[]): Promise<void> {
    if (!this.collection) throw new Error('Vector collection not initialized.');
    await this.collection.add({
      ids: chunks.map(c => c.id),
      documents: chunks.map(c => \`\${c.symbolName} (\${c.symbolType}) in \${c.filePath}:\\n\${c.content}\`),
      metadatas: chunks.map(c => ({
        filePath: c.filePath,
        symbolName: c.symbolName,
        symbolType: c.symbolType,
        startLine: c.startLine,
        endLine: c.endLine,
        language: c.language,
      })),
    });
  }

  public async similaritySearch(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (!this.collection) throw new Error('Vector collection not initialized.');
    const results = await this.collection.query({
      queryTexts: [query],
      nResults: topK,
    });
    // Format and return ranked chunks with cosine similarity
    return [];
  }
}
`,
      },
      {
        id: 'f-ts-4',
        repositoryId: 'repo-ts-code-archaeologist',
        path: 'src/rag/rag-orchestrator.ts',
        name: 'rag-orchestrator.ts',
        language: 'TypeScript',
        size: 3100,
        linesCount: 82,
        symbolsCount: 3,
        imports: ['@google/genai', './vector-store', '../types'],
        classes: ['RAGOrchestrator'],
        functions: ['answerQuestion', 'buildGroundedPrompt'],
        content: `import { GoogleGenAI } from '@google/genai';
import { ChromaVectorStore } from './vector-store';
import { RAGResponse, EvidenceItem } from '../types';

export class RAGOrchestrator {
  private ai: GoogleGenAI;
  private vectorStore: ChromaVectorStore;

  constructor(apiKey: string, vectorStore: ChromaVectorStore) {
    this.ai = new GoogleGenAI({ apiKey });
    this.vectorStore = vectorStore;
  }

  public async answerQuestion(repositoryId: string, question: string): Promise<RAGResponse> {
    // 1. Retrieve top-k semantic code chunks from ChromaDB
    const retrievedChunks = await this.vectorStore.similaritySearch(question, 5);

    // 2. Assemble grounded context with file paths and line ranges
    const context = this.buildContext(retrievedChunks);

    // 3. Grounded prompt requiring strict evidence citation
    const prompt = \`
You are the RepoMind software-analysis engine.
Answer the developer's question STRICTLY based on the provided repository code chunks.
If the repository context does not contain enough information, reply:
"I could not find enough evidence in the analyzed repository to answer this confidently."

REPOSITORY CONTEXT:
\${context}

QUESTION:
\${question}
\`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return {
      question,
      answer: response.text || 'No response generated.',
      grounded: true,
      confidenceStatus: 'Supported by repository evidence',
      retrievedChunksCount: retrievedChunks.length,
      relevantFiles: [],
      evidence: [],
      durationMs: 420,
    };
  }

  private buildContext(chunks: any[]): string {
    return chunks.map(c => \`[File: \${c.filePath}, Lines: \${c.startLine}-\${c.endLine}]\\n\${c.content}\`).join('\\n\\n');
  }
}
`,
      },
    ],
    symbols: [
      {
        id: 'sym-ts-1',
        fileId: 'f-ts-1',
        filePath: 'src/analyzers/ast-parser.ts',
        name: 'ASTParser',
        type: 'class',
        startLine: 4,
        endLine: 58,
        signature: 'export class ASTParser',
        docstring: 'Web-Tree-sitter wrapper for parsing multi-language ASTs and extracting symbols.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-ts-2',
        fileId: 'f-ts-1',
        filePath: 'src/analyzers/ast-parser.ts',
        name: 'parseSourceFile',
        type: 'method',
        startLine: 18,
        endLine: 25,
        signature: 'public parseSourceFile(code: string, filePath: string): SymbolItem[]',
        docstring: 'Parse source code string into AST symbol list.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-ts-3',
        fileId: 'f-ts-2',
        filePath: 'src/analyzers/chunker.ts',
        name: 'SemanticChunker',
        type: 'class',
        startLine: 3,
        endLine: 32,
        signature: 'export class SemanticChunker',
        docstring: 'Chunks source files along logical AST boundaries (functions/classes).',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-ts-4',
        fileId: 'f-ts-3',
        filePath: 'src/rag/vector-store.ts',
        name: 'ChromaVectorStore',
        type: 'class',
        startLine: 4,
        endLine: 45,
        signature: 'export class ChromaVectorStore',
        docstring: 'ChromaDB client for indexing and retrieving code chunks.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-ts-5',
        fileId: 'f-ts-4',
        filePath: 'src/rag/rag-orchestrator.ts',
        name: 'RAGOrchestrator',
        type: 'class',
        startLine: 5,
        endLine: 58,
        signature: 'export class RAGOrchestrator',
        docstring: 'Coordinates retrieval from ChromaDB and grounded generation with Gemini.',
        detectedFrom: 'Tree-sitter AST',
      },
    ],
    dependencies: [
      { id: 'dep-ts-1', source: 'src/analyzers/chunker.ts', target: 'src/types', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-ts-2', source: 'src/rag/vector-store.ts', target: 'chromadb', relationshipType: 'depends_on', category: 'external' },
      { id: 'dep-ts-3', source: 'src/rag/rag-orchestrator.ts', target: '@google/genai', relationshipType: 'depends_on', category: 'external' },
      { id: 'dep-ts-4', source: 'src/rag/rag-orchestrator.ts', target: 'src/rag/vector-store.ts', relationshipType: 'imports', category: 'internal' },
      { id: 'dep-ts-5', source: 'src/analyzers/ast-parser.ts', target: 'web-tree-sitter', relationshipType: 'depends_on', category: 'external' },
    ],
    chunks: [
      {
        id: 'chk-ts-1',
        repositoryId: 'repo-ts-code-archaeologist',
        filePath: 'src/analyzers/ast-parser.ts',
        language: 'TypeScript',
        symbolType: 'class',
        symbolName: 'ASTParser',
        startLine: 4,
        endLine: 58,
        content: `export class ASTParser {
  public parseSourceFile(code: string, filePath: string): SymbolItem[] {
    const tree = this.parser.parse(code);
    return this.extractSymbols(tree.rootNode, filePath);
  }
}`,
      },
      {
        id: 'chk-ts-2',
        repositoryId: 'repo-ts-code-archaeologist',
        filePath: 'src/rag/rag-orchestrator.ts',
        language: 'TypeScript',
        symbolType: 'class',
        symbolName: 'RAGOrchestrator',
        startLine: 5,
        endLine: 58,
        content: `export class RAGOrchestrator {
  public async answerQuestion(repositoryId: string, question: string): Promise<RAGResponse> {
    const retrievedChunks = await this.vectorStore.similaritySearch(question, 5);
    const response = await this.ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    return { question, answer: response.text, grounded: true, confidenceStatus: 'Supported by repository evidence' };
  }
}`,
      },
    ],
  },
  'repo-java-spring-microservice': {
    repo: {
      id: 'repo-java-spring-microservice',
      name: 'spring-boot-inventory-service',
      owner: 'repomind',
      url: 'https://github.com/repomind/spring-boot-inventory-service',
      defaultBranch: 'main',
      description: 'Enterprise Spring Boot REST API for warehouse inventory management with Spring Data JPA, Hibernate, JWT Security Filter, and Maven build setup.',
      status: 'COMPLETED',
      progress: 100,
      statusMessage: 'Analysis completed. 5 files parsed, 14 symbols extracted, 18 chunks indexed.',
      createdAt: '2026-09-18T11:00:00Z',
      updatedAt: '2026-09-24T09:30:00Z',
      stats: {
        filesCount: 5,
        dirsCount: 4,
        classesCount: 6,
        functionsCount: 15,
        dependenciesCount: 16,
        linesOfCode: 420,
        chunksCount: 18,
        languages: [
          { name: 'Java', percentage: 94.0, filesCount: 4, color: '#b07219' },
          { name: 'XML', percentage: 6.0, filesCount: 1, color: '#0060ac' },
        ],
      },
      summary: 'Spring Boot 3.x microservice architecture implementing RESTful CRUD operations for inventory items. Includes Spring Security with JWT filter, JPA repository queries, and custom exception handling.',
      architectureSummary: 'Classic 3-tier Spring architecture: Controller (InventoryController) handles HTTP requests and input validation; Service (InventoryService) encapsulates business transactions; Repository (InventoryRepository) interacts with the SQL database via Spring Data JPA.',
    },
    files: [
      {
        id: 'f-java-1',
        repositoryId: 'repo-java-spring-microservice',
        path: 'src/main/java/com/example/inventory/InventoryApplication.java',
        name: 'InventoryApplication.java',
        language: 'Java',
        size: 920,
        linesCount: 22,
        symbolsCount: 2,
        imports: ['org.springframework.boot.SpringApplication', 'org.springframework.boot.autoconfigure.SpringBootApplication'],
        classes: ['InventoryApplication'],
        functions: ['main'],
        content: `package com.example.inventory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InventoryApplication {
    public static void main(String[] args) {
        SpringApplication.run(InventoryApplication.class, args);
    }
}
`,
      },
      {
        id: 'f-java-2',
        repositoryId: 'repo-java-spring-microservice',
        path: 'src/main/java/com/example/inventory/controller/InventoryController.java',
        name: 'InventoryController.java',
        language: 'Java',
        size: 2450,
        linesCount: 65,
        symbolsCount: 5,
        imports: ['org.springframework.web.bind.annotation.*', 'org.springframework.http.ResponseEntity', 'com.example.inventory.service.InventoryService'],
        classes: ['InventoryController'],
        functions: ['getAllItems', 'getItemById', 'createItem', 'updateStock'],
        content: `package com.example.inventory.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import java.util.List;
import com.example.inventory.model.InventoryItem;
import com.example.inventory.service.InventoryService;

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {
    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    public ResponseEntity<List<InventoryItem>> getAllItems() {
        return ResponseEntity.ok(inventoryService.findAll());
    }

    @GetMapping("/{sku}")
    public ResponseEntity<InventoryItem> getItemBySku(@PathVariable String sku) {
        return inventoryService.findBySku(sku)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<InventoryItem> createItem(@RequestBody InventoryItem item) {
        InventoryItem saved = inventoryService.save(item);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PatchMapping("/{sku}/stock")
    public ResponseEntity<InventoryItem> updateStock(@PathVariable String sku, @RequestParam int delta) {
        return ResponseEntity.ok(inventoryService.adjustStock(sku, delta));
    }
}
`,
      },
      {
        id: 'f-java-3',
        repositoryId: 'repo-java-spring-microservice',
        path: 'src/main/java/com/example/inventory/service/InventoryService.java',
        name: 'InventoryService.java',
        language: 'Java',
        size: 2100,
        linesCount: 58,
        symbolsCount: 4,
        imports: ['org.springframework.stereotype.Service', 'org.springframework.transaction.annotation.Transactional', 'com.example.inventory.repository.InventoryRepository'],
        classes: ['InventoryService'],
        functions: ['findAll', 'findBySku', 'save', 'adjustStock'],
        content: `package com.example.inventory.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;
import com.example.inventory.model.InventoryItem;
import com.example.inventory.repository.InventoryRepository;

@Service
@Transactional
public class InventoryService {
    private final InventoryRepository repository;

    public InventoryService(InventoryRepository repository) {
        this.repository = repository;
    }

    public List<InventoryItem> findAll() {
        return repository.findAll();
    }

    public Optional<InventoryItem> findBySku(String sku) {
        return repository.findBySku(sku);
    }

    public InventoryItem save(InventoryItem item) {
        return repository.save(item);
    }

    public InventoryItem adjustStock(String sku, int delta) {
        InventoryItem item = repository.findBySku(sku)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + sku));
        int updated = item.getQuantity() + delta;
        if (updated < 0) {
            throw new IllegalStateException("Insufficient stock for SKU: " + sku);
        }
        item.setQuantity(updated);
        return repository.save(item);
    }
}
`,
      },
    ],
    symbols: [
      {
        id: 'sym-jv-1',
        fileId: 'f-java-1',
        filePath: 'src/main/java/com/example/inventory/InventoryApplication.java',
        name: 'InventoryApplication',
        type: 'class',
        startLine: 6,
        endLine: 11,
        signature: 'public class InventoryApplication',
        docstring: 'Spring Boot main configuration and startup runner.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-jv-2',
        fileId: 'f-java-2',
        filePath: 'src/main/java/com/example/inventory/controller/InventoryController.java',
        name: 'InventoryController',
        type: 'class',
        startLine: 11,
        endLine: 45,
        signature: 'public class InventoryController',
        docstring: 'REST controller providing inventory CRUD endpoints.',
        detectedFrom: 'Tree-sitter AST',
      },
      {
        id: 'sym-jv-3',
        fileId: 'f-java-3',
        filePath: 'src/main/java/com/example/inventory/service/InventoryService.java',
        name: 'InventoryService',
        type: 'class',
        startLine: 10,
        endLine: 42,
        signature: 'public class InventoryService',
        docstring: 'Service layer managing inventory business logic and transactional stock adjustments.',
        detectedFrom: 'Tree-sitter AST',
      },
    ],
    dependencies: [
      { id: 'dep-jv-1', source: 'InventoryController', target: 'InventoryService', relationshipType: 'calls', category: 'internal' },
      { id: 'dep-jv-2', source: 'InventoryService', target: 'InventoryRepository', relationshipType: 'calls', category: 'internal' },
      { id: 'dep-jv-3', source: 'InventoryController', target: 'org.springframework.web', relationshipType: 'depends_on', category: 'external' },
    ],
    chunks: [
      {
        id: 'chk-jv-1',
        repositoryId: 'repo-java-spring-microservice',
        filePath: 'src/main/java/com/example/inventory/service/InventoryService.java',
        language: 'Java',
        symbolType: 'class',
        symbolName: 'InventoryService',
        startLine: 10,
        endLine: 42,
        content: `public class InventoryService {
    public InventoryItem adjustStock(String sku, int delta) {
        InventoryItem item = repository.findBySku(sku)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + sku));
        item.setQuantity(item.getQuantity() + delta);
        return repository.save(item);
    }
}`,
      },
    ],
  },
};
