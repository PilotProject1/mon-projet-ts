import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TwoFactorService } from './two-factor.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let twoFactor: jest.Mocked<TwoFactorService>;

  const user = {
    id: 'user-1',
    email: 'test@syneco.app',
    name: 'Test User',
    role: 'user',
    passwordHash: '',
    twoFactorEnabledAt: null as Date | null,
    twoFactorSecret: null as string | null,
    twoFactorLastStep: null as number | null,
  };

  beforeEach(async () => {
    user.passwordHash = await bcrypt.hash('correct-password', 10);
    user.twoFactorEnabledAt = null;

    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    twoFactor = {
      verifierCode: jest.fn(),
    } as unknown as jest.Mocked<TwoFactorService>;

    authService = new AuthService(usersService, jwtService, twoFactor);
  });

  describe('register', () => {
    it('rejects an email that already exists', async () => {
      usersService.findByEmail.mockResolvedValue(user as any);

      await expect(
        authService.register({ email: user.email, password: 'x', name: 'x' }),
      ).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('hashes the password and returns tokens + public user shape', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(user as any);

      const result = await authService.register({
        email: user.email,
        password: 'correct-password',
        name: user.name,
      });

      const createArg = usersService.create.mock.calls[0][0];
      expect(createArg.passwordHash).not.toBe('correct-password');
      expect(
        await bcrypt.compare('correct-password', createArg.passwordHash),
      ).toBe(true);
      expect(result.user).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect((result.user as any).passwordHash).toBeUndefined();
    });
  });

  describe('login', () => {
    it('rejects an unknown email without revealing that it does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'ghost@syneco.app', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(user as any);

      await expect(
        authService.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens on correct credentials', async () => {
      usersService.findByEmail.mockResolvedValue(user as any);

      const result = await authService.login({
        email: user.email,
        password: 'correct-password',
      });

      if ('deuxiemeFacteurRequis' in result) {
        throw new Error('Ce compte ne demande pas de second facteur');
      }
      expect(result.accessToken).toBe('signed-token');
      expect(result.user.id).toBe(user.id);
    });

    /*
     * Le point qui fait tenir toute la double authentification : sur un
     * compte protégé, un mot de passe correct ne délivre aucun jeton
     * d'accès. Si ce test tombe, le second facteur ne protège plus rien.
     */
    it('ne délivre aucun jeton quand la double authentification est active', async () => {
      user.twoFactorEnabledAt = new Date();
      usersService.findByEmail.mockResolvedValue(user as any);

      const result = await authService.login({
        email: user.email,
        password: 'correct-password',
      });

      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
      expect(result).toMatchObject({ deuxiemeFacteurRequis: true });
    });

    it('refuse un jeton de défi présenté à la place du mot de passe', async () => {
      jwtService.verify.mockReturnValue({
        sub: user.id,
        email: user.email,
        typ: 'acces',
      });

      await expect(
        authService.loginDeuxiemeFacteur('jeton-d-acces', '123456'),
      ).rejects.toThrow(UnauthorizedException);
      expect(twoFactor.verifierCode).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rejects an invalid or expired refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('expired');
      });

      await expect(authService.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token for a user that no longer exists', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'ghost-id',
        email: 'ghost@syneco.app',
      });
      usersService.findById.mockResolvedValue(null);

      await expect(authService.refresh('some-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues new tokens for a valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: user.id, email: user.email });
      usersService.findById.mockResolvedValue(user as any);

      const result = await authService.refresh('valid-token');

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.id).toBe(user.id);
    });
  });

  describe('me', () => {
    it('throws if the user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(authService.me('ghost-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns the public shape of the current user', async () => {
      usersService.findById.mockResolvedValue(user as any);

      const result = await authService.me(user.id);

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    });
  });
});
